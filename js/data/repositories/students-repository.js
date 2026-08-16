import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.STUDENTS);

export const studentsRepository = Object.freeze({
  ...repository,
  listByGroup(groupId) {
    return repository.list(where("groupId", "==", groupId));
  },
});
