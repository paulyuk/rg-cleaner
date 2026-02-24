import { app } from '@azure/functions';

app.setup({
    enableHttpStream: true,
});

// Import RG Cleaner MCP tools
import './functions/rgCleanerTools';
