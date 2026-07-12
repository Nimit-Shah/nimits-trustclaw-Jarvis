import { Command } from "commander";
import { deploy } from "./deploy.js";

const program = new Command();
program
  .name("nimits-jarvis")
  .description("Deploy nimits-jarvis to Vercel")
  .version("0.1.0");

program
  .command("deploy")
  .description("Deploy a fresh nimits-jarvis instance to Vercel")
  .action(deploy);

program.parseAsync();
