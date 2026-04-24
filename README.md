# InfoNexus

A powerful utility for viewing and managing order details with flexible data visualization options.

## Overview

InfoNexus is a lightweight, fast web application built with **Vite** and vanilla JavaScript that provides an intuitive interface for searching, viewing, and exporting order information. It supports multiple view modes, pagination, catalog browsing, and seamless API integration.

## Features

✨ **Multiple View Modes**

- **Summary View**: Quick overview of order data
- **Paginated View**: Browse results with configurable items per page
- **All Items View**: Display all results at once

🔍 **Smart Search**

- Search by order ID or customer information
- Real-time search with keyboard shortcuts (Enter to search)
- Multiple search type options

📊 **Flexible Display**

- Adjustable pagination (1-100 items per page)
- Responsive design
- Clean, organized data presentation

📦 **Product Catalog**

- Browse complete product catalog
- Quick-load product information

📥 **Data Export**

- Export order data in multiple formats
- Easy-to-use export functionality

🚀 **Fast & Lightweight**

- Built with Vite for instant dev server startup
- No heavy framework dependencies
- Optimized for performance

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Sufyaan2706/infornexus.git
cd infornexus

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173/`

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
infornexus/
├── refactored/                 # Main application root
│   ├── index.html             # Application entry point
│   ├── catalog.html           # Catalog page
│   ├── styles.css             # Global styles
│   ├── image/                 # Static images
│   └── js/
│       ├── main.js            # Main app controller
│       ├── api.js             # API client & data fetching
│       ├── catalog.js         # Catalog controller
│       ├── config.js          # Configuration & credentials
│       ├── ui.js              # UI rendering & state
│       ├── utils.js           # Utility functions
│       ├── export.js          # Export functionality
│       ├── decodeScript.js    # Data decoding utilities
│       └── testing.js         # Testing utilities
├── package.json               # Project metadata & scripts
├── vite.config.js            # Vite configuration
└── README.md                  # This file
```

## Configuration

The application uses configuration from `js/config.js`. You'll need to set up:

- **API Credentials**: Basic authentication credentials for proxy access
- **Customer ID**: Your customer identifier
- **Proxy URL**: Endpoint for the API proxy server

These credentials should be configured in `config.js` before deploying to production.

## Usage

### Search for Orders

1. Select search type from the dropdown
2. Enter search query (order ID, customer name, etc.)
3. Press Enter or click the Search button
4. Results will display in your selected view mode

### Change View Mode

Click the view control buttons to toggle between:

- **Summary**: Compact overview
- **Paginated**: Browse with pagination controls
- **All**: Show all results

### Adjust Pagination

Use the "Items Per Page" selector to control how many results appear per page (available in paginated view).

### Export Data

Use the export functionality to download order data in your preferred format.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Modern browsers with ES6+ support

## Technologies Used

- **Vite** - Fast build tool and dev server
- **Vanilla JavaScript** - No framework dependencies
- **Fetch API** - HTTP requests
- **ES6 Modules** - Modern JavaScript modules

## Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start development server with hot reload |
| `npm run build`   | Build optimized production bundle        |
| `npm run preview` | Preview production build locally         |
| `npm test`        | Run tests (to be configured)             |

## Authors

- **Mukul**
- **Sufyaan**

## License

ISC License - See package.json for details

## Repository

[GitHub Repository](https://github.com/Sufyaan2706/infornexus)

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/Sufyaan2706/infornexus/issues)

--- from the Intern
