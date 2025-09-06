// App bootstrap: wires controllers and main tool
import DrawingTool from './drawingTool.js';

class App {
  constructor() {
    this.tool = null;
  }

  init() {
    this.tool = new DrawingTool();
    try { window.app = this; } catch(_) {}
  }
}

export default App;

