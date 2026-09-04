import { trainingStatsToolDefinition } from "@repo/ai";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Bubble, BubbleContent } from "@repo/ui/components/ui/bubble";
import { Button } from "@repo/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/ui/empty";
import { Message, MessageAvatar, MessageContent } from "@repo/ui/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui/components/ui/message-scroller";
import { Textarea } from "@repo/ui/components/ui/textarea";
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
  ActivityIcon,
  AlertCircleIcon,
  ArrowUpIcon,
  BrainCircuitIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  MessageCircleIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
  SquareIcon,
} from "lucide-react";
import { createContext, useContext, useState } from "react";
import { ENV } from "varlock/env";

import { useSession } from "@/lib/auth-client";

const chatOptions = {
  connection: fetchServerSentEvents(`${ENV.BACKEND_URL}/api/chat`, {
    credentials: "include",
  }),
  tools: [trainingStatsToolDefinition],
};

type ChatOptions = typeof chatOptions;

const TrainingAssistantControls = createContext<{ close: () => void } | null>(null);

function useTrainingAssistantControls() {
  const controls = useContext(TrainingAssistantControls);
  if (!controls) throw new Error("TrainingAssistant controls are unavailable");
  return controls;
}

const streamingExtensions = [streamingMarkdownExtension()];

function ChatLayout({ Messages, Interrupts, Queue, Input }: LayoutProps<ChatOptions>) {
  const chat = useChatContext();
  const { close } = useTrainingAssistantControls();

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <header className="bg-card flex shrink-0 items-center justify-between border-b px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <SparklesIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight">Training assistant</p>
            <p className="text-muted-foreground text-xs">Your numbers, explained</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear conversation"
            onClick={() => chat.clear()}
            disabled={chat.messages.length === 0 || chat.isLoading}
          >
            <Trash2Icon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close training assistant"
            onClick={close}
          >
            <XIcon />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller className="min-h-0">
            <MessageScrollerViewport aria-label="Training assistant messages" className="px-4">
              <MessageScrollerContent aria-busy={chat.isLoading} className="gap-5 py-5">
                {chat.error ? (
                  <ChatError error={chat.error} onRetry={() => void chat.reload()} />
                ) : null}
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

      <div className="bg-background/95 shrink-0 border-t px-4 py-4 backdrop-blur">
        <Input />
      </div>
    </div>
  );
}

function ChatError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <MessageScrollerItem messageId="chat-error">
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Response stopped</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{error.message}</span>
          <Button variant="destructive" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </MessageScrollerItem>
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
  const { data: session } = useSession();
  const userInitial = session?.user.name?.trim().slice(0, 1).toUpperCase() || "Y";

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor={isUser}>
      <Message align={isUser ? "end" : "start"} className="gap-3">
        <MessageAvatar className="size-8 min-w-8 self-start">
          <Avatar size="sm" className="size-8">
            {isUser ? (
              <>
                <AvatarImage src={session?.user.image ?? undefined} alt="" />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </>
            ) : (
              <AvatarFallback className="bg-background text-muted-foreground ring-border ring-1">
                <BotIcon className="size-4" />
              </AvatarFallback>
            )}
          </Avatar>
        </MessageAvatar>
        <MessageContent className="gap-2">
          {isUser ? (
            <div className="bg-primary text-primary-foreground max-w-[90%] self-end rounded-2xl rounded-br-sm px-4 py-3 text-sm shadow-sm">
              <p className="whitespace-pre-wrap">
                {message.parts.map((part) => (part.type === "text" ? part.content : "")).join("")}
              </p>
            </div>
          ) : (
            <Parts />
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

function TextPart({ part }: PartProps<ChatOptions, "text">) {
  return (
    <Bubble variant="muted">
      <BubbleContent
        className={
          "text-sm leading-relaxed " +
          "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
          "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold " +
          "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold " +
          "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold " +
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 " +
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 " +
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
          "[&_strong]:font-semibold " +
          "[&_blockquote]:border-primary/30 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic " +
          "[&_code]:bg-background/70 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] " +
          "[&_pre]:bg-background/70 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:p-2.5 [&_pre]:text-xs [&_pre]:leading-relaxed " +
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
          "[&_hr]:border-border [&_hr]:my-3"
        }
      >
        <Markdown
          allowHtml={false}
          extensions={streamingExtensions}
          frontmatter={false}
          headingIds={false}
        >
          {part.content}
        </Markdown>
      </BubbleContent>
    </Bubble>
  );
}

function ThinkingPart({ part }: PartProps<ChatOptions, "thinking">) {
  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-1 text-left text-xs transition-colors">
        <BrainCircuitIcon className="size-3.5 shrink-0" />
        <span className="flex-1 font-medium">Reasoning notes</span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground ml-1.5 border-l pl-5 text-xs leading-relaxed">
        <p className="py-1 whitespace-pre-wrap">{part.content}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

type ToolStatus = "running" | "complete" | "error";

function getToolStatus(
  part: ToolProps<ChatOptions, "get_training_stats">["part"],
  result: ToolProps<ChatOptions, "get_training_stats">["result"],
): ToolStatus {
  if (part.state === "error" || result?.state === "error") return "error";
  if (part.state === "complete" || result?.state === "complete") return "complete";
  return "running";
}

function ToolStatusIcon({ status }: { status: ToolStatus }) {
  if (status === "error") return <AlertCircleIcon className="size-3.5" />;
  if (status === "complete") return <CheckCircle2Icon className="size-3.5" />;
  return <ActivityIcon className="size-3.5 animate-pulse" />;
}

function getToolOutput(
  part: ToolProps<ChatOptions, "get_training_stats">["part"],
  result: ToolProps<ChatOptions, "get_training_stats">["result"],
): unknown {
  if (part.state === "error") return part.output ?? "The stats lookup failed.";
  if (result?.state === "error") return result.error ?? "The stats lookup failed.";
  if (part.output !== undefined) return part.output;
  if (result?.content !== undefined) return result.content;
  return "No stats output yet.";
}

function TrainingStatsTool({ part, result }: ToolProps<ChatOptions, "get_training_stats">) {
  const status = getToolStatus(part, result);
  const statusLabel =
    status === "error" ? "Needs attention" : status === "complete" ? "Complete" : "Running";
  const output = getToolOutput(part, result);
  const outputText =
    typeof output === "string"
      ? output
      : (JSON.stringify(output, null, 2) ?? "No stats output yet.");

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-1 text-left text-xs transition-colors">
        <ToolStatusIcon status={status} />
        <span className="flex-1 font-medium">Training stats</span>
        <span className="text-[11px]">{statusLabel}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground ml-1.5 border-l pl-5">
        <pre className="max-h-40 overflow-auto py-1 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap">
          {outputText}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolResultPart({ part }: PartProps<ChatOptions, "toolResult">) {
  const isError = part.state === "error" || Boolean(part.error);
  const content = isError
    ? (part.error ?? "The stats lookup failed.")
    : typeof part.content === "string"
      ? part.content
      : (JSON.stringify(part.content, null, 2) ?? "No stats output returned.");

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-1 text-left text-xs transition-colors">
        {isError ? (
          <AlertCircleIcon className="text-destructive size-3.5 shrink-0" />
        ) : (
          <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="flex-1 font-medium">Stats evidence</span>
        <span className="text-[11px]">{isError ? "Failed" : "Loaded"}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground ml-1.5 border-l pl-5">
        <pre className="max-h-40 overflow-auto py-1 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap">
          {content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FallbackPart({ part }: PartProps<ChatOptions>) {
  return <p className="text-muted-foreground text-xs">Unsupported content: {part.type}</p>;
}

function ChatInput(_props: InputProps<ChatOptions>) {
  const chat = useChatContext();
  const [draft, setDraft] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text || chat.isLoading) return;
    setDraft("");
    void chat.sendMessage(text);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full"
    >
      <div className="focus-within:border-ring focus-within:ring-ring/20 bg-muted/20 relative rounded-xl border shadow-sm transition-colors focus-within:ring-2">
        <Textarea
          name="message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask about your stats..."
          aria-label="Ask about your training stats"
          maxLength={2_000}
          className="min-h-20 resize-none border-0 bg-transparent px-3 py-3 pr-14 shadow-none focus-visible:ring-0"
          disabled={chat.isLoading}
        />
        <Button
          aria-label={chat.isLoading ? "Stop response" : "Send message"}
          className="absolute right-2 bottom-2"
          disabled={!chat.isLoading && !draft.trim()}
          onClick={chat.isLoading ? () => chat.stop() : undefined}
          size="icon-sm"
          type={chat.isLoading ? "button" : "submit"}
          variant={chat.isLoading ? "destructive" : "default"}
        >
          {chat.isLoading ? (
            <SquareIcon className="size-3.5" />
          ) : (
            <ArrowUpIcon className="size-4" />
          )}
        </Button>
      </div>
      <p className="text-muted-foreground px-1 pt-2 text-[10px]">Shift+Enter for a new line</p>
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
    toolResult: ToolResultPart,
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
          className="bg-card text-card-foreground ring-foreground/10 h-[min(700px,calc(100vh-2rem))] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-2 shadow-2xl ring-1"
        >
          <TrainingAssistantControls.Provider value={{ close: () => setIsOpen(false) }}>
            <chat.AppChat />
          </TrainingAssistantControls.Provider>
        </section>
      )}

      {!isOpen && (
        <Button
          size="lg"
          className="ring-background/80 size-12 rounded-full p-0 shadow-lg ring-4"
          aria-label="Open training assistant"
          aria-expanded={false}
          onClick={() => setIsOpen(true)}
        >
          <MessageCircleIcon />
          <span className="sr-only">Ask about your training</span>
        </Button>
      )}
    </div>
  );
}
