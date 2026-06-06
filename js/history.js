/** Undo / redo stack */

export class History {
  constructor(maxSize = 60) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
  }

  push(snapshot) {
    const json = JSON.stringify(snapshot);
    if (this.undoStack.length && this.undoStack[this.undoStack.length - 1] === json) {
      return;
    }
    this.undoStack.push(json);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(currentSnapshot) {
    if (!this.canUndo()) return null;
    this.redoStack.push(JSON.stringify(currentSnapshot));
    return JSON.parse(this.undoStack.pop());
  }

  redo(currentSnapshot) {
    if (!this.canRedo()) return null;
    this.undoStack.push(JSON.stringify(currentSnapshot));
    return JSON.parse(this.redoStack.pop());
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
