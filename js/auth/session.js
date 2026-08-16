import { waitForAuthUser } from "./auth-service.js";
import { usersRepository } from "../data/repositories/users-repository.js";

export async function getSession() {
  const authUser = await waitForAuthUser();
  if (!authUser) {
    return null;
  }

  const profile = await usersRepository.getById(authUser.uid);
  return profile ? { authUser, profile } : null;
}

