import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { refreshCategories } from "./public";

export const categoriesBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "categories",
  run: ({ db, userId }) => {
    void refreshCategories(db, userId);
  },
};
