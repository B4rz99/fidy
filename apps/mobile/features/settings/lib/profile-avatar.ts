import { getUserInitials } from "./settings-links";

type ProfileAvatarInput = {
  readonly fullName: string;
  readonly email: string;
  readonly profileImageUrl: string | null;
  readonly didImageFail: boolean;
};

export type ProfileAvatar =
  | { readonly type: "image"; readonly uri: string }
  | { readonly type: "initials"; readonly initials: string };

export function deriveProfileAvatar(input: ProfileAvatarInput): ProfileAvatar {
  if (input.profileImageUrl && !input.didImageFail) {
    return { type: "image", uri: input.profileImageUrl };
  }

  return { type: "initials", initials: getUserInitials(input.fullName, input.email) };
}
