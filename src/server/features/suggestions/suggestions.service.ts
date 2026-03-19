import SuggestionQueries from './suggestions.queries.js';
import Servers from '@server/features/servers/servers.queries.js';
import * as modService from '@server/features/mods/mods.service.js';
import { generateModOverrides } from '@server/services/lua.js';

class SuggestionService {
  async getSuggestions(code: string, userId: number, userRole: string) {
    const server = await SuggestionQueries.findServerByCode(code);
    if (!server) throw new Error('Server not found');

    const isMember = await Servers.isGuest(server.id, userId);
    if (userRole !== 'admin' && server.user_id !== userId && !isMember) {
      throw new Error('Forbidden');
    }

    return SuggestionQueries.findByServerCode(code);
  }

  async createSuggestion(code: string, userId: number, userRole: string, workshopId: string, suggestedConfig: any) {
    if (!workshopId) throw new Error('Workshop ID required');

    const server = await SuggestionQueries.findServerByCode(code);
    if (!server) throw new Error('Server not found');

    if (userRole !== 'admin' && server.user_id === userId) {
      throw new Error('Owners cannot suggest mods on their own server');
    }

    await SuggestionQueries.create(server.id, userId, workshopId, JSON.stringify(suggestedConfig || {}));
  }

  async approveSuggestion(id: number, userId: number, userRole: string) {
    const suggestion = await SuggestionQueries.findByIdWithServer(id);
    if (!suggestion) throw new Error('Suggestion not found');
    if (userRole !== 'admin' && suggestion.server_owner !== userId) {
      throw new Error('Forbidden');
    }

    await SuggestionQueries.updateStatus(id, 'approved');

    const shareCode = suggestion.share_code!;
    const workshopId = suggestion.workshop_id;
    const suggestedConfig = suggestion.suggested_config
      ? JSON.parse(suggestion.suggested_config)
      : {};

    const currentMods = await modService.getServerModOverrides(shareCode) || {};
    const modKey = `workshop-${workshopId}`;

    if (!(modKey in currentMods)) {
      await modService.downloadMods([workshopId]);

      currentMods[modKey] = {
        enabled: true,
        configuration_options: suggestedConfig,
      };

      const content = generateModOverrides(currentMods);
      await modService.saveModOverrides(shareCode, content);

      const enabledCount = Object.values(currentMods).filter((m) => m.enabled).length;
      await Servers.updateModCount(suggestion.srv_id!, enabledCount);
    }
  }

  async denySuggestion(id: number, userId: number, userRole: string) {
    const suggestion = await SuggestionQueries.findByIdWithServer(id);
    if (!suggestion) throw new Error('Suggestion not found');
    if (userRole !== 'admin' && suggestion.server_owner !== userId) {
      throw new Error('Forbidden');
    }

    await SuggestionQueries.updateStatus(id, 'denied');
  }
}

export const suggestionService = new SuggestionService();
