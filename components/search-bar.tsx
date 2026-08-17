"use client";

import {
  ArrowRight,
  Building2,
  Command,
  Compass,
  Globe2,
  Landmark,
  Search,
  SearchX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { extractDomain } from "@/lib/company-query";
import type { CompanySuggestion } from "@/lib/types/company";
import { cn } from "@/lib/utils";

type LookupState = "idle" | "loading" | "ready" | "empty" | "unavailable";

function isSuggestion(value: unknown): value is CompanySuggestion {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.description === "string" &&
    typeof item.query === "string" &&
    (item.source === "wikidata" ||
      item.source === "gleif" ||
      item.source === "web" ||
      item.source === "domain")
  );
}

export function SearchBar({
  compact = false,
  defaultValue = "",
}: {
  compact?: boolean;
  defaultValue?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || normalized === defaultValue) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLookupState("loading");
      setOpen(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as unknown;
        if (typeof payload !== "object" || payload === null) throw new Error();
        const record = payload as Record<string, unknown>;
        const matches = Array.isArray(record.suggestions)
          ? record.suggestions.filter(isSuggestion)
          : [];
        setSuggestions(matches);
        setActiveIndex(matches.length > 0 ? 0 : -1);
        setLookupState(
          record.unavailable === true
            ? "unavailable"
            : matches.length > 0
              ? "ready"
              : "empty",
        );
      } catch (lookupError) {
        if (
          lookupError instanceof DOMException &&
          lookupError.name === "AbortError"
        )
          return;
        setSuggestions([]);
        setActiveIndex(-1);
        setLookupState("unavailable");
      }
    }, 280);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [defaultValue, query]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        )
          return;
        event.preventDefault();
        inputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function resetScrollPosition() {
    inputRef.current?.blur();
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      root.style.scrollBehavior = previousBehavior;
    });
  }

  function navigate(value: string) {
    setOpen(false);
    setError("");
    resetScrollPosition();
    router.push(`/company/${encodeURIComponent(value.toLowerCase())}`, {
      scroll: true,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = extractDomain(query) ?? query.trim();
    if (normalized.length < 2) {
      setError("Enter a company name or official domain.");
      inputRef.current?.focus();
      return;
    }
    if (lookupState === "empty" && !extractDomain(query)) {
      setError(
        "No verified match. Check the spelling or paste the official domain.",
      );
      setOpen(true);
      return;
    }
    if (open && activeIndex >= 0 && suggestions[activeIndex]) {
      navigate(suggestions[activeIndex].query);
      return;
    }
    navigate(normalized);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
    setActiveIndex((current) => {
      if (suggestions.length === 0) return -1;
      if (event.key === "ArrowDown") return (current + 1) % suggestions.length;
      return current <= 0 ? suggestions.length - 1 : current - 1;
    });
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div
      className={cn("relative z-30 w-full", compact ? "max-w-xl" : "max-w-3xl")}
    >
      <form
        onSubmit={submit}
        className={cn(
          "group relative z-20 flex items-center border bg-[#0d1118]/95 shadow-[0_30px_120px_rgba(0,0,0,0.5)] transition duration-300 focus-within:border-blue-300/40 focus-within:shadow-[0_0_0_4px_rgba(120,169,255,0.08),0_30px_120px_rgba(0,0,0,0.5)]",
          showDropdown ? "rounded-t-[22px] rounded-b-none" : "rounded-[22px]",
          compact
            ? "h-12 border-white/10"
            : "signal-glow h-[68px] border-white/[0.12]",
        )}
      >
        <Search
          className={cn(
            "ml-5 shrink-0 text-blue-200/65",
            compact ? "size-4" : "size-5",
          )}
          aria-hidden="true"
        />
        <label
          htmlFor={compact ? "company-search-compact" : "company-search"}
          className="sr-only"
        >
          Search for a company
        </label>
        <input
          ref={inputRef}
          id={compact ? "company-search-compact" : "company-search"}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
            setLookupState("idle");
            setOpen(event.target.value.trim().length >= 2);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          placeholder="Search any company or paste its domain…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-describedby={error ? "search-error" : undefined}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent px-4 text-white placeholder:text-white/35 focus:outline-none",
            compact ? "text-sm" : "text-base sm:text-[17px]",
          )}
        />
        {!compact && (
          <span className="mr-2 hidden items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 font-mono text-[10px] text-white/45 sm:flex">
            <Command className="size-3" aria-hidden="true" />K
          </span>
        )}
        <button
          type="submit"
          className={cn(
            "mr-2 grid shrink-0 place-items-center rounded-2xl bg-blue-300 text-[#071226] shadow-[0_8px_24px_rgba(120,169,255,0.25)] transition hover:bg-blue-200 active:scale-95",
            compact ? "size-9" : "size-[52px]",
          )}
          aria-label="Research company"
        >
          <ArrowRight
            className={compact ? "size-4" : "size-5"}
            aria-hidden="true"
          />
        </button>
      </form>

      {showDropdown ? (
        <div
          className={cn(
            "absolute right-0 left-0 z-50 overflow-hidden rounded-b-[22px] border border-t-0 border-white/[0.1] bg-[#0b0f16]/98 pt-3 shadow-[0_28px_80px_rgba(0,0,0,.55)] backdrop-blur-xl",
            compact ? "top-[47px]" : "top-[67px]",
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 font-mono text-[9px] tracking-[0.16em] text-white/40 uppercase">
            <span>Company matches</span>
            {lookupState === "ready" ? (
              <span>{suggestions.length} found</span>
            ) : null}
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label="Company matches"
            className="max-h-[180px] touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.18)_transparent] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          >
            {lookupState === "loading" || lookupState === "idle" ? (
              <div
                className="space-y-2 px-4 py-3"
                aria-label="Searching companies"
                aria-busy="true"
              >
                {["w-3/5", "w-4/5", "w-2/3"].map((width) => (
                  <div
                    key={width}
                    className="flex items-center gap-3 rounded-xl px-2 py-2"
                  >
                    <span className="shimmer size-8 rounded-xl bg-white/[0.05]" />
                    <span
                      className={cn(
                        "shimmer h-3 rounded-full bg-white/[0.05]",
                        width,
                      )}
                    />
                  </div>
                ))}
              </div>
            ) : lookupState === "ready" ? (
              suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigate(suggestion.query)}
                  className={cn(
                    "flex h-[60px] w-full items-center gap-3 px-4 text-left transition",
                    activeIndex === index
                      ? "bg-blue-300/[0.08]"
                      : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
                    {suggestion.source === "domain" ? (
                      <Globe2
                        className="size-4 text-blue-200/65"
                        aria-hidden="true"
                      />
                    ) : suggestion.source === "gleif" ? (
                      <Landmark
                        className="size-4 text-blue-200/65"
                        aria-hidden="true"
                      />
                    ) : suggestion.source === "web" ? (
                      <Compass
                        className="size-4 text-blue-200/65"
                        aria-hidden="true"
                      />
                    ) : (
                      <Building2
                        className="size-4 text-blue-200/65"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white/85">
                      {suggestion.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/45">
                      {suggestion.description}
                    </span>
                  </span>
                  <span className="font-mono text-[8px] tracking-wider text-white/35 uppercase">
                    {suggestion.source === "domain"
                      ? "Domain"
                      : suggestion.source === "gleif"
                        ? "Legal entity"
                        : suggestion.source === "web"
                          ? "Official site"
                          : "Verified"}
                  </span>
                </button>
              ))
            ) : (
              <div className="flex items-start gap-3 px-5 py-5" role="status">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
                  <SearchX
                    className="size-4 text-white/45"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="text-sm font-medium text-white/75">
                    {lookupState === "unavailable"
                      ? "Company search is temporarily unavailable"
                      : "No verified company match"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-white/45">
                    Check the spelling or paste the company’s official domain
                    for broader coverage.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 text-[10px] text-white/35">
            Structured records · legal entities · public web
          </div>
        </div>
      ) : null}

      <p
        id="search-error"
        role="alert"
        className="mt-2 min-h-5 pl-4 text-xs text-red-300"
      >
        {error}
      </p>
    </div>
  );
}
