import { router } from "~/server/api/trpc";
import { list } from "./list";
import { create } from "./create";
import { rename } from "./rename";
import { deleteChat } from "./delete";
import { updateModel } from "./updateModel";
import { search } from "./search";
import { issuesCount } from "./issues-count";

export const chatsRouter = router({
  list,
  create,
  rename,
  delete: deleteChat,
  updateModel,
  search,
  issuesCount,
});