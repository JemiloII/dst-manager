# Don't Starve Together Server Manager

A web-based management interface for Don't Starve Together dedicated servers with multi-user support, mod management, and real-time monitoring.

## Features

- **Multi-user System**: Admin, regular users, and guest accounts with role-based access
- **Server Management**: Create, configure, start/stop DST dedicated servers
- **Real-time Monitoring**: Live player counts and server status via SSE
- **Mod Management**: Browse, install, and configure Steam Workshop mods
- **Share Links**: 6-character share codes for guest access to servers
- **Log Viewer**: Real-time log streaming for Master and Caves shards
- **World Configuration**: Visual world settings editor with icon-based UI
- **Ticket System**: Support ticket system for user issues
- **Export**: Download server clusters as .zip files

## Prerequisites

- Node.js 20+
- pnpm package manager
- Don't Starve Together Dedicated Server installed
- SteamCMD (for server updates)
- Linux/macOS (Windows WSL supported)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/dst-server-manager.git
cd dst-server-manager
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy the environment template:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Path to DST dedicated server installation
DST_INSTALL_DIR=/home/user/dst-dedicated

# Path to template folder (contains default server configs)
DST_TEMPLATE_DIR=./dst

# Directory where server instances will be created
SERVERS_DIR=./servers

# Your Klei User ID (found in your DST account)
ADMIN_KUID=KU_XXXXXXXX

# Admin credentials (created on first launch)
ADMIN_USER=admin
ADMIN_PASS=changeme

# Starting port for server allocation (each server uses 7 ports)
BASE_PORT=10000

# Server hostname for share links
SERVER_HOST=localhost

# JWT secret for authentication
JWT_SECRET=your-secret-key-here

# Web server port
PORT=7891

# Database URL (optional, defaults to local file)
DATABASE_URL=file:dst-manager.db
```

## Usage

### Development

Start the development server with hot reload:
```bash
pnpm dev
```

### Production

Build and run in production:
```bash
pnpm build
pnpm start
```

## Server Port Allocation

Each DST server requires 7 ports:
- Master port
- 2x Server ports
- 2x Master server ports  
- 2x Authentication ports

Ports are automatically allocated starting from `BASE_PORT`. For example, if `BASE_PORT=10000`:
- Server 1: ports 10000-10006
- Server 2: ports 10007-10013
- Server 3: ports 10014-10020

## User Roles

- **Admin**: Full access to all servers, can manage users and resolve tickets
- **User**: Can create and manage their own servers
- **Guest**: Can view shared servers and suggest mods/settings

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/guest` - Create guest session
- `GET /api/servers` - List servers
- `POST /api/servers` - Create server
- `GET /api/servers/:id` - Get server details
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `GET /api/servers/:id/logs` - Stream server logs
- `GET /api/mods/search` - Search Steam Workshop
- `POST /api/mods/install` - Install mod
- `POST /api/suggestions` - Submit mod suggestion
- `POST /api/tickets` - Create support ticket

## Tech Stack

- **Backend**: Hono + Node.js + TypeScript
- **Frontend**: React + Vite + Zustand + Pico CSS
- **Database**: libSQL (Turso-compatible)
- **Auth**: JWT bearer tokens
- **Real-time**: Server-Sent Events (SSE)

## Theme

- Primary color: `#FF8A00`
- Dark mode background: `bg_redux_dark_right.png`
- Light mode background: `bg_spiral.png`
- Vignette overlay: `bg_vignette.png`


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
