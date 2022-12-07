const { NumberPrompt } = require("enquirer");
import { setupPrompt } from "./functions/setupTablefunctions";

export function mainPrompt() {
  /*
  The Prompt funtion is designed to bring a user 
  through a series of questions in the right order lower
  numbered prompts must be complete before higher number
  prompts (0 before 1)
   so that they calc excute, update, delete table in the proper 
   order of operations
  */

  console.clear();
  console.log("Please enter the number for your selection");
  console.log("0...Set up database");
  console.log("1...update/truncate tables");
  console.log("2...FIFO prompts");
  console.log("3...Realized prompts");

  const prompt = new NumberPrompt({
    name: "number",
    message: "Please enter a number",
  });

  prompt.run().then(function (answer) {
    if (answer === 0) {
      setupPrompt().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      answer = null;
    }
    if (answer === 1) {
      answer = null;
    }
    if (answer === 2) {
    }
    if (answer === 3) {
    }
  });
}
////----end of mainPrompt function---------------------------------------

mainPrompt();
