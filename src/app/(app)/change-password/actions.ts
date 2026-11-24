"use server";
import { updatePassword } from "@/app/(auth)/reset-password/actions";

export async function changePassword(formData: FormData) {
  return updatePassword(formData);
}
