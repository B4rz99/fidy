type ResolveChatComposerSendInput = {
  readonly text: string;
  readonly disabled: boolean;
};

export type ChatComposerSendResolution = {
  readonly canSend: boolean;
  readonly message: string | null;
  readonly nextText: string;
};

export const resolveChatComposerSend = ({
  text,
  disabled,
}: ResolveChatComposerSendInput): ChatComposerSendResolution => {
  const message = text.trim();
  if (!message || disabled) {
    return { canSend: false, message: null, nextText: text };
  }

  return { canSend: true, message, nextText: "" };
};
