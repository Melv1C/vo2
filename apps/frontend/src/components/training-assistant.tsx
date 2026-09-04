import { trainingStatsToolDefinition } from "@repo/ai";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Bubble, BubbleContent } from "@repo/ui/components/ui/bubble";
import { Button } from "@repo/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/ui/components/ui/input-group";
import { Message, MessageAvatar, MessageContent } from "@repo/ui/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui/components/ui/message-scroller";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { fetchServerSentEvents } from "@tanstack/ai-react";
import {
  createChatHook,
  type InputProps,
  type LayoutProps,
  type MessageProps,
  type PartProps,
  type ToolProps,
} from "@tanstack/ai-react/ui";
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming";
import { Markdown } from "@tanstack/markdown/react";
import {
  BotIcon,
  CheckIcon,
  CircleStopIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { ENV } from "varlock/env";

const chatOptions = {
  connection: fetchServerSentEvents(`${ENV.BACKEND_URL}/api/chat`, {
    credentials: "include",
  }),
  tools: [trainingStatsToolDefinition],
};

type ChatOptions = typeof chatOptions;

function ChatLayout({ Messages, Interrupts, Queue, Input }: LayoutProps<ChatOptions>) {
  const chat = useChatContext();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
            <SparklesIcon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Training assistant</p>
            <p className="text-muted-foreground text-[11px]">Your numbers, explained</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Clear conversation"
          onClick={() => chat.clear()}
          disabled={chat.messages.length === 0 || chat.isLoading}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="min-h-0 flex-1 px-1">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport aria-label="Training assistant messages" className="px-3">
              <MessageScrollerContent aria-busy={chat.isLoading} className="gap-3 py-4">
                {chat.messages.length === 0 ? <AssistantEmptyState /> : <Messages />}
                <Interrupts />
                <Queue />
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton
              direction="end"
              variant="secondary"
              size="icon-sm"
              aria-label="Scroll to latest message"
            />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      {chat.error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mx-4 mb-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
          <span>Could not finish that response.</span>
          <Button variant="destructive" size="xs" onClick={() => void chat.reload()}>
            <RotateCcwIcon />
            Retry
          </Button>
        </div>
      )}

      <div className="border-t p-3">
        <Input />
      </div>
    </div>
  );
}

function AssistantEmptyState() {
  const chat = useChatContext();

  const suggestions = [
    "How has my training load changed recently?",
    "Am I carrying more fatigue than usual?",
    "Which sports contributed most to my load?",
  ];

  return (
    <Empty className="min-h-[300px] border-0 px-3 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BotIcon />
        </EmptyMedia>
        <EmptyTitle>Ask about your training</EmptyTitle>
        <EmptyDescription>
          I can explain your load, fitness, fatigue, freshness, activities, and data quality.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex w-full flex-col gap-1.5">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              className="h-auto justify-start px-3 py-2 text-left text-xs whitespace-normal"
              onClick={() => void chat.sendMessage(suggestion)}
              disabled={chat.isLoading}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </EmptyContent>
    </Empty>
  );
}

function ChatMessage({ message, Parts }: MessageProps<ChatOptions>) {
  const isUser = message.role === "user";

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor={isUser}>
      <Message align={isUser ? "end" : "start"} className="gap-2">
        <MessageAvatar className="size-6 min-w-6 self-start">
          <Avatar className="size-6 rounded-md">
            <AvatarFallback className="bg-muted text-muted-foreground rounded-md">
              {isUser ? "You" : <BotIcon className="size-3.5" />}
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent className="gap-1">
          <div className="text-muted-foreground px-1 text-[10px] font-medium">
            {isUser ? "You" : "VO2 assistant"}
          </div>
          <Parts />
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

function TextPart({ part }: PartProps<ChatOptions, "text">) {
  return (
    <Bubble variant={part.type === "text" ? "muted" : "outline"}>
      <BubbleContent
        className={
          "text-xs leading-relaxed " +
          "[&_p+ p]:mt-2 [&_p]:my-0 " +
          "[&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold " +
          "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold " +
          "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold " +
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 " +
          "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 " +
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
          "[&_strong]:font-semibold " +
          "[&_blockquote]:border-primary/30 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic " +
          "[&_code]:bg-background/70 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] " +
          "[&_pre]:bg-background/70 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:p-2.5 [&_pre]:text-[11px] [&_pre]:leading-relaxed " +
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
          "[&_hr]:border-border [&_hr]:my-2 " +
          "[&_table]:my-2 [&_table]:w-full [&_table]:text-[11px] " +
          "[&_th]:border-border [&_th]:border-b [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold " +
          "[&_td]:border-border [&_td]:border-b [&_td]:px-1.5 [&_td]:py-1"
        }
      >
        {part.type === "text" ? (
          <Markdown extensions={[streamingMarkdownExtension()]}>{part.content}</Markdown>
        ) : null}
      </BubbleContent>
    </Bubble>
  );
}

function ThinkingPart({ part }: PartProps<ChatOptions, "thinking">) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs">
      <Spinner className="size-3" />
      <span>{part.type === "thinking" ? "Reviewing your training data" : "Working"}</span>
    </div>
  );
}

function TrainingStatsTool({ part }: ToolProps<ChatOptions, "get_training_stats">) {
  const isComplete = part.state === "complete";

  return (
    <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-[11px]">
      {isComplete ? (
        <CheckIcon className="size-3 text-emerald-600" />
      ) : (
        <Spinner className="size-3" />
      )}
      <span>{isComplete ? "Training data loaded" : "Reading training data"}</span>
    </div>
  );
}

function FallbackPart({ part }: PartProps<ChatOptions>) {
  if (part.type === "tool-result") return null;
  return null;
}

function ChatInput(_props: InputProps<ChatOptions>) {
  const chat = useChatContext();
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || chat.isLoading) return;
    setValue("");
    void chat.sendMessage(text);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <InputGroup className="min-h-10">
        <InputGroupTextarea
          name="message"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your stats..."
          aria-label="Ask about your training stats"
          maxLength={2_000}
          rows={1}
          disabled={chat.isLoading}
        />
        <InputGroupAddon align="inline-end">
          {chat.isLoading ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              aria-label="Stop response"
              onClick={() => chat.stop()}
            >
              <CircleStopIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              aria-label="Send message"
              disabled={!value.trim()}
            >
              <SendIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="text-muted-foreground px-1 text-[10px]">Shift+Enter for a new line</p>
    </form>
  );
}

const { useAppChat, useChatContext } = createChatHook({
  options: chatOptions,
  components: {
    layout: ChatLayout,
    message: ChatMessage,
    input: ChatInput,
  },
  partsComponents: {
    text: TextPart,
    thinking: ThinkingPart,
    fallback: FallbackPart,
  },
  toolsComponents: {
    get_training_stats: TrainingStatsTool,
  },
});

export function TrainingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const chat = useAppChat();

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {isOpen && (
        <section
          aria-label="Training assistant"
          className="bg-card text-card-foreground ring-foreground/10 h-[min(650px,calc(100vh-6rem))] w-[min(410px,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-2xl ring-1"
        >
          <div className="relative h-full">
            <chat.AppChat />
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-3 right-10 z-10"
              aria-label="Close training assistant"
              onClick={() => setIsOpen(false)}
            >
              <XIcon />
            </Button>
          </div>
        </section>
      )}

      <Button
        size="lg"
        className="ring-background/80 size-12 rounded-full p-0 shadow-lg ring-4"
        aria-label={isOpen ? "Close training assistant" : "Open training assistant"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <XIcon /> : <MessageCircleIcon />}
        <span className="sr-only">{isOpen ? "Close assistant" : "Ask about your training"}</span>
      </Button>
    </div>
  );
}
