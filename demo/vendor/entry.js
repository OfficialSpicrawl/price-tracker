// What the page needs of ascii.rest, in one script: mount() and the two pieces it plays.
import { mount } from "ascii.rest";
import sparkline, * as sparklinePiece from "./pieces/sparkline.js";
import terminal, * as terminalPiece from "./pieces/terminal.js";
export { priceAt } from "./pieces/terminal.js";

export { mount };
export const pieces = { sparkline: sparklinePiece, terminal: terminalPiece };
void sparkline;
void terminal;
