import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

export const groupsRepository = createRepository(COLLECTIONS.GROUPS);

