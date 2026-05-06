import { Controller, Get, Res, Header } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Serves the embeddable chat widget JavaScript file.
 * The widget is served as a static JS file that can be embedded on any website.
 */
@Controller()
export class WidgetController {
  @Get('widget.js')
  serveWidget(@Res() res: any) {
    const widgetPath = path.join(__dirname, '..', '..', 'public', 'widget.js');

    if (!fs.existsSync(widgetPath)) {
      res.status(404).send('// Widget not found');
      return;
    }

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(widgetPath);
  }
}
