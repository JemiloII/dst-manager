import './ModListItem.scss';

interface ModListItemProps {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string;
  configOptions?: number;
  isInstalled?: boolean;
  isEnabled?: boolean;
  onToggle?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  onAdd?: () => void;
  isOwner?: boolean;
  addButtonLabel?: string;
}

function parseBBCode(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[url\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\[list\]/g, '<ul>')
    .replace(/\[\/list\]/g, '</ul>')
    .replace(/\[\*\]/g, '<li>')
    .replace(/\[h1\](.*?)\[\/h1\]/g, '<h3>$1</h3>')
    .replace(/\[h2\](.*?)\[\/h2\]/g, '<h4>$1</h4>')
    .replace(/\[h3\](.*?)\[\/h3\]/g, '<h5>$1</h5>')
    .replace(/\[spoiler\](.*?)\[\/spoiler\]/g, '<details><summary>Spoiler</summary>$1</details>')
    .replace(/\[code\](.*?)\[\/code\]/g, '<code>$1</code>')
    .replace(/\[quote\](.*?)\[\/quote\]/g, '<blockquote>$1</blockquote>')
    .replace(/\[img\](.*?)\[\/img\]/g, '')
    .replace(/\n/g, '<br />');
}

export default function ModListItem({
  workshopId,
  title,
  description,
  previewUrl,
  configOptions = 0,
  isInstalled = false,
  isEnabled = false,
  onToggle,
  onConfigure,
  onRemove,
  onAdd,
  isOwner = true,
  addButtonLabel = 'Add Mod',
}: ModListItemProps) {
  return (
    <div className="mod-item">
      <div className="mod-content">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mod-thumbnail" />
        ) : (
          <div className="mod-thumbnail-placeholder" />
        )}
        <div className="mod-info">
          <div className="mod-header">
            <span className="mod-title">{title}</span>
          </div>
          {description && (
            <details>
              <summary>Description</summary>
              <div dangerouslySetInnerHTML={{ __html: parseBBCode(description) }} />
            </details>
          )}
          <a 
            href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mod-link"
          >
            View on Steam Workshop
          </a>
        </div>
      </div>
      {isOwner && (
        <div className="mod-actions">
          {isInstalled ? (
            <>
              <button 
                onClick={onRemove} 
                className="icon-btn mod-delete-btn"
                title="Remove"
              >
                <img src="/images/button_icons/delete.png" alt="Remove" />
              </button>
              {configOptions > 0 ? (
                <button 
                  className="icon-btn"
                  title="Configure"
                  onClick={onConfigure}
                >
                  <img src="/images/button_icons/configure_mod.png" alt="Configure" />
                </button>
              ) : (
                <div className="icon-btn-placeholder"></div>
              )}
              <button 
                onClick={onToggle} 
                className="icon-btn"
                title={isEnabled ? 'Disable' : 'Enable'}
              >
                <img 
                  src={isEnabled ? '/images/button_icons/enabled_filter.png' : '/images/button_icons/disabled_filter.png'} 
                  alt={isEnabled ? 'Disable' : 'Enable'} 
                />
              </button>
            </>
          ) : (
            <button
              onClick={onAdd}
              className="btn btn-primary mod-btn"
            >
              {addButtonLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}