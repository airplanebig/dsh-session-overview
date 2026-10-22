window.__ModuleLoader__.load({
	id: "dsh-session-overview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/** Sidebar panel id — also the key of the main-slot page. */
		const PANEL_ID = "session-overview";
		/** Dictionary namespace owned by this plugin. */
		const NS = "session-overview";
		/** Where the layout preference is kept. */
		const LAYOUT_KEY = "dsh-session-overview:layout";
		/** Whether to confirm the matched session before delivering. */
		const ASK_KEY = "dsh-session-overview:ask";
		/** Whether session labels show their workspace. */
		const WS_KEY = "dsh-session-overview:workspace";
		/** Debounce for the routing search, in ms. */
		const SEARCH_DEBOUNCE_MS = 250;
		/** How many terms the live preview searches (cheap, on every pause). */
		const LIVE_QUERY_LIMIT = 4;
		/** How many terms the confirm step searches (authoritative, once per send). */
		const CONFIRM_QUERY_LIMIT = 10;
		/** Services required by this browser half. */
		const inject = ["slots", "sessions", "workspaces", "uiWorkspace", "locale", "layout"];

		/** Design-system tokens, with fallbacks so a missing variable never blanks the UI. */
		const T = {
			labelPrimary: "var(--dsw-alias-label-primary, currentColor)",
			labelSecondary: "var(--dsw-alias-label-secondary, inherit)",
			labelTertiary: "var(--dsw-alias-label-tertiary, inherit)",
			borderL1: "var(--dsw-alias-border-l1, rgba(127,127,127,0.18))",
			borderL2: "var(--dsw-alias-border-l2, rgba(127,127,127,0.28))",
			bgLayer1: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.05))",
			bgLayer2: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))",
			hover: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.14))",
			active: "var(--dsw-alias-interactive-bg-active, rgba(127,127,127,0.22))",
			brand: "var(--dsw-alias-brand-primary, #4d6bfe)",
			radiusMd: "var(--dsw-radius-md, 8px)",
			radiusLg: "var(--dsw-radius-lg, 12px)",
			menuFill: "var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-2, #24262c))",
			elevation: "var(--dsw-elevation-panel, 0 12px 32px rgba(0,0,0,0.32))",
		};

		const DICT = {
			zh: {
				panel: "会话总览",
				title: "会话总览",
				hint: "工作区一行、会话一格；点一格跳到那个会话。",
				empty: "暂无会话数据",
				back: "返回会话",
				unnamed: "(未命名会话)",
				other: "其他",
				perRow: "每行",
				workspaceUnit: "个工作区",
				sessionUnit: "个会话",
				composerLabel: "发到会话",
				composerPlaceholder: "在这里输入，回车发送（Shift+回车换行）",
				send: "发送",
				sending: "发送中…",
				confirm: "确认发送",
				sent: "已发送",
				sendFailed: "发送失败",
				noTarget: "先选一个会话",
				searchOff: "宿主未启用内容检索，只能按会话名与目录匹配（用下面的过滤框手选更快）",
				filterPlaceholder: "过滤会话名…",
				recent: "最近使用",
				askLabel: "发送前询问会话",
				showWorkspace: "显示工作区",
				showWorkspaceHint: "在会话名旁标出所属工作区；同名工作区会自动带上父目录区分",
				confirmTo: "将投递到",
				confirmHint: "回车确认 · Esc 取消",
				cancel: "取消",
				recommended: "推荐",
				locked: "已锁定",
				autoMode: "自动",
				lockedHint: "已锁定手动选择，输入变化不会改变目标",
				autoFallback: "未找到匹配，暂用最近会话",
				auto: "自动匹配",
				matchedByContent: "按对话内容匹配",
				matchedByTitle: "按会话标题匹配",
				matchedByPath: "按工作区目录匹配",
				matchedRecent: "没找到匹配，用最近会话",
				justNow: "刚刚",
				minutesAgo: " 分钟前",
				hoursAgo: " 小时前",
				daysAgo: " 天前",
			},
			en: {
				panel: "Session overview",
				title: "Session overview",
				hint: "Workspaces across, sessions inside. Click a card to open that session.",
				empty: "No sessions yet",
				back: "Back to conversation",
				unnamed: "(untitled session)",
				other: "Other",
				perRow: "Per row",
				workspaceUnit: "workspaces",
				sessionUnit: "sessions",
				composerLabel: "Send to session",
				composerPlaceholder: "Type here, Enter to send (Shift+Enter for a newline)",
				send: "Send",
				sending: "Sending…",
				confirm: "Confirm send",
				sent: "Sent",
				sendFailed: "Send failed",
				noTarget: "Pick a session first",
				searchOff: "Content search is disabled on this host; matching uses session names and folders only",
				filterPlaceholder: "Filter sessions…",
				recent: "Recent",
				askLabel: "Ask before sending",
				showWorkspace: "Show workspace",
				showWorkspaceHint: "Tag sessions with their workspace; same-named workspaces get a parent folder to tell them apart",
				confirmTo: "Will send to",
				confirmHint: "Enter to confirm · Esc to cancel",
				cancel: "Cancel",
				recommended: "Suggested",
				locked: "Locked",
				autoMode: "Auto",
				lockedHint: "Locked to your manual choice; typing will not change the target",
				autoFallback: "No match yet, using the most recent session",
				auto: "Auto match",
				matchedByContent: "matched by conversation content",
				matchedByTitle: "matched by session title",
				matchedByPath: "matched by workspace folder",
				matchedRecent: "no match, using the most recent session",
				justNow: "just now",
				minutesAgo: "m ago",
				hoursAgo: "h ago",
				daysAgo: "d ago",
			},
		};

		/** Subscribe to a uSES-style store ({ subscribe, getSnapshot }). */
		function useStore(store) {
			const subscribe = React.useCallback(
				(onChange) => (store && typeof store.subscribe === "function" ? store.subscribe(onChange) : () => {}),
				[store]
			);
			const snapshot = React.useCallback(() => {
				try {
					return store && typeof store.getSnapshot === "function" ? store.getSnapshot() : null;
				} catch (error) {
					return null;
				}
			}, [store]);
			return React.useSyncExternalStore(subscribe, snapshot, snapshot);
		}

		/** Last path segment of a Windows or POSIX directory. */
		function baseName(path) {
			if (typeof path !== "string" || path === "") return "";
			const trimmed = path.replace(/[\\/]+$/, "");
			const at = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return at >= 0 ? trimmed.slice(at + 1) : trimmed;
		}

		/** Human label for "how long ago". */
		function ago(timestamp, t) {
			if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
			const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
			if (seconds < 60) return t("justNow");
			if (seconds < 3600) return Math.round(seconds / 60) + t("minutesAgo");
			if (seconds < 86400) return Math.round(seconds / 3600) + t("hoursAgo");
			return Math.round(seconds / 86400) + t("daysAgo");
		}

		function clampInt(value, min, max, fallback) {
			const number = Number(value);
			if (!Number.isFinite(number)) return fallback;
			return Math.min(max, Math.max(min, Math.round(number)));
		}

		/** Parent directory basename, used to tell same-named workspaces apart. */
		function parentName(path) {
			if (typeof path !== "string" || path === "") return "";
			const trimmed = path.replace(/[\\/]+$/, "");
			const at = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return at > 0 ? baseName(trimmed.slice(0, at)) : "";
		}

		/**
		 * Map session id -> workspace label.
		 *
		 * Two workspaces can legitimately share a basename (`D:\A\新建文件夹` and
		 * `D:\B\新建文件夹`). When that happens the label is qualified with the parent
		 * folder; distinct labels are left short.
		 */
		function buildWorkspaceLabels(workspaceRows) {
			const entries = (workspaceRows || []).map((workspace) => ({
				cwd: workspace.cwd,
				label: workspace.title || baseName(workspace.cwd) || workspace.workspaceId,
				sessionIds: workspace.sessionIds || [],
			}));
			const counts = new Map();
			for (const entry of entries) counts.set(entry.label, (counts.get(entry.label) || 0) + 1);

			const map = new Map();
			for (const entry of entries) {
				let label = entry.label;
				if ((counts.get(label) || 0) > 1) {
					const parent = parentName(entry.cwd);
					if (parent && parent !== label) label = parent + "/" + label;
				}
				for (const id of entry.sessionIds) if (!map.has(id)) map.set(id, label);
			}
			return map;
		}

		// ---------------------------------------------------------------- routing --
		/** Lowercase and drop whitespace/punctuation so CJK and ASCII compare alike. */
		function normalize(text) {
			return String(text || "")
				.toLowerCase()
				.replace(/[\s\u3000-\u303f\uff00-\uffef!-/:-@[-`{-~]+/g, "");
		}

		/** Character bigrams — the cheapest tokenizer that works for Chinese. */
		function bigrams(text) {
			const value = normalize(text);
			const out = new Set();
			if (value.length < 2) {
				if (value) out.add(value);
				return out;
			}
			for (let i = 0; i < value.length - 1; i++) out.add(value.slice(i, i + 2));
			return out;
		}

		/** Share of the query's bigrams that also appear in the candidate text. */
		function overlapScore(query, text) {
			const q = bigrams(query);
			if (q.size === 0) return 0;
			const t = bigrams(text);
			let hit = 0;
			for (const gram of q) if (t.has(gram)) hit++;
			return hit / q.size;
		}

		/**
		 * Turn a free-form request into searchable terms.
		 *
		 * `ctx.sessions.search` matches a *literal phrase*: passing a whole sentence
		 * returns nothing because no conversation contains that exact sentence. So the
		 * draft is reduced to high-signal terms — ASCII identifiers first (Bow, arrow,
		 * weapon), then CJK bigrams in order (背包, 攻速, …).
		 */
		function extractKeywords(draft, limit) {
			const text = String(draft || "");
			const out = [];
			const seen = new Set();
			const push = (value) => {
				const key = String(value || "").toLowerCase();
				if (value.length < 2 || seen.has(key) || out.length >= limit) return;
				seen.add(key);
				out.push(value);
			};

			for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9_+#.\-]{1,}/g)) push(match[0]);

			for (const run of text.match(/[\u3400-\u9fff]{2,}/g) || []) {
				for (let i = 0; i + 2 <= run.length && out.length < limit; i++) push(run.slice(i, i + 2));
			}

			return out.slice(0, limit);
		}

		/**
		 * Split a draft into clauses on punctuation/whitespace.
		 *
		 * A trailing aside —「（可以考虑将攻速处理迁移至weapon）」— is a separate clause;
		 * scoring per clause instead of over the whole sentence keeps such an aside from
		 * diluting an otherwise strong match.
		 */
		function splitClauses(text) {
			return String(text || "")
				.split(/[\s,，。；;：:!！?？、|/\\()（）\[\]【】<>《》"'“”‘’]+/)
				.map((part) => part.trim())
				.filter((part) => part.length >= 2);
		}

		/**
		 * Rank sessions for a query.
		 *
		 * Content hits from `ctx.sessions.search` dominate; when the host has no
		 * content index (or returns nothing) titles and folder names are scored
		 * locally, and recency only breaks ties. Returns candidates high to low.
		 */
		function rankCandidates(query, rows, searchItems, workspaceTitleOf) {
			if (!query || !query.trim()) return [];
			const hits = new Map();
			(searchItems || []).forEach((item, index) => {
				const id = item && (item.id || item.sessionId);
				if (!id) return;
				const previous = hits.get(id);
				if (previous) {
					previous.count += 1;
					previous.rank = Math.min(previous.rank, index);
					return;
				}
				hits.set(id, { rank: index, count: 1, snippet: item.snippet || "" });
			});

			const clauses = splitClauses(query);
			const scoringClauses = clauses.length ? clauses : [query];
			/** Best clause match: an unmatched aside cannot drag the score down. */
			const bestClause = (text) => {
				let best = 0;
				for (const clause of scoringClauses) {
					const score = overlapScore(clause, text);
					if (score > best) best = score;
				}
				return best;
			};

			const candidates = rows.map((row) => {
				const hit = hits.get(row.id);
				const titleScore = bestClause(row.title || "");
				const pathScore = bestClause(baseName(row.cwd) || "") * 0.5;
				const ageHours = Math.max(0, (Date.now() - (row.updatedAt || 0)) / 3600000);
				const recency = Math.max(0, 0.12 - ageHours / 2400);
				// several query terms hitting the same session is stronger evidence than one
				const contentScore = hit ? 1 + Math.min(0.3, 0.1 * hit.count) : 0;
				const score = contentScore + titleScore + pathScore + recency;
				const reason = hit ? "content" : titleScore > 0 ? "title" : pathScore > 0 ? "path" : "recent";
				return { id: row.id, score, reason, title: row.title || "", snippet: hit ? hit.snippet : "" };
			});

			return candidates.sort((a, b) => b.score - a.score);
		}

		/** Best candidate when it is clearly ahead; otherwise nothing. */
		function pickBest(candidates) {
			const first = candidates[0];
			if (!first) return null;
			const second = candidates[1];
			const margin = second ? first.score - second.score : first.score;
			if (first.score < 0.35 || margin < 0.05) return null;
			return first;
		}

		/** Human explanation for how a candidate was matched. */
		function reasonText(reason, t) {
			return reason === "content"
				? t("matchedByContent")
				: reason === "title"
					? t("matchedByTitle")
					: reason === "path"
						? t("matchedByPath")
						: t("matchedRecent");
		}

		/** Read the saved layout, falling back to defaults. */
		function readLayout() {
			const fallback = { workspaceCols: 2, sessionCols: 3 };
			try {
				const raw = window.localStorage && window.localStorage.getItem(LAYOUT_KEY);
				if (!raw) return fallback;
				const parsed = JSON.parse(raw);
				return {
					workspaceCols: clampInt(parsed.workspaceCols, 1, 4, fallback.workspaceCols),
					sessionCols: clampInt(parsed.sessionCols, 1, 6, fallback.sessionCols),
				};
			} catch (error) {
				return fallback;
			}
		}

		function saveLayout(layout) {
			try {
				if (window.localStorage) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
			} catch (error) {
				/* storage is best effort */
			}
		}

		/** Whether a send should first ask which session to deliver to. Defaults to on. */
		function readAsk() {
			try {
				const raw = window.localStorage && window.localStorage.getItem(ASK_KEY);
				return raw === null ? true : raw === "1";
			} catch (error) {
				return true;
			}
		}

		function saveAsk(value) {
			try {
				if (window.localStorage) window.localStorage.setItem(ASK_KEY, value ? "1" : "0");
			} catch (error) {
				/* storage is best effort */
			}
		}

		/** Whether labels carry their workspace. Defaults to on. */
		function readShowWorkspace() {
			try {
				const raw = window.localStorage && window.localStorage.getItem(WS_KEY);
				return raw === null ? true : raw === "1";
			} catch (error) {
				return true;
			}
		}

		function saveShowWorkspace(value) {
			try {
				if (window.localStorage) window.localStorage.setItem(WS_KEY, value ? "1" : "0");
			} catch (error) {
				/* storage is best effort */
			}
		}

		const grid = (columns) => ({
			display: "grid",
			gridTemplateColumns: "repeat(" + columns + ", minmax(0, 1fr))",
			gap: 14,
			alignItems: "start",
		});

		const styles = {
			page: {
				height: "100%",
				overflowY: "auto",
				padding: "24px 28px 40px",
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 14,
				boxSizing: "border-box",
			},
			header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 },
			title: { fontSize: 18, fontWeight: 600, color: T.labelPrimary },
			button: {
				padding: "5px 12px",
				borderRadius: T.radiusMd,
				border: "1px solid " + T.borderL2,
				background: T.bgLayer1,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 12,
				cursor: "pointer",
			},
			hint: { fontSize: 12, color: T.labelTertiary, marginBottom: 16 },
			toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, marginBottom: 18, fontSize: 12 },
			field: { display: "flex", alignItems: "center", gap: 8, color: T.labelSecondary },
			segmented: {
				display: "inline-flex",
				border: "1px solid " + T.borderL2,
				borderRadius: T.radiusMd,
				overflow: "hidden",
			},
			segment: {
				minWidth: 26,
				padding: "2px 8px",
				border: "none",
				borderRight: "1px solid " + T.borderL1,
				background: "transparent",
				color: T.labelSecondary,
				font: "inherit",
				fontSize: 12,
				cursor: "pointer",
			},
			segmentActive: {
				minWidth: 26,
				padding: "2px 8px",
				border: "none",
				borderRight: "1px solid " + T.borderL1,
				background: T.active,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 12,
				fontWeight: 600,
				cursor: "pointer",
			},
			composer: {
				border: "1px solid " + T.borderL2,
				borderRadius: T.radiusLg,
				background: T.bgLayer1,
				padding: 12,
				marginBottom: 22,
			},
			recentRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 },
			recentLabel: { fontSize: 11, color: T.labelTertiary, marginRight: 2 },
			recentChip: {
				maxWidth: 150,
				padding: "2px 9px",
				borderRadius: 999,
				border: "1px solid " + T.borderL1,
				background: "transparent",
				color: T.labelSecondary,
				font: "inherit",
				fontSize: 11.5,
				cursor: "pointer",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			recentChipActive: {
				maxWidth: 150,
				padding: "2px 9px",
				borderRadius: 999,
				border: "1px solid " + T.brand,
				background: T.active,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 11.5,
				cursor: "pointer",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			composerHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 },
			composerLabel: { fontSize: 12, color: T.labelSecondary },
			textarea: {
				width: "100%",
				minHeight: 58,
				resize: "vertical",
				padding: "8px 10px",
				borderRadius: T.radiusMd,
				border: "1px solid " + T.borderL1,
				background: T.bgLayer2,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 13,
				boxSizing: "border-box",
			},
			composerRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" },
			primary: {
				padding: "6px 16px",
				borderRadius: T.radiusMd,
				border: "none",
				background: "var(--dsw-alias-button-primary-fill, " + T.brand + ")",
				color: "var(--dsw-alias-label-primary-foreground, #fff)",
				font: "inherit",
				fontSize: 12.5,
				cursor: "pointer",
			},
			primaryDisabled: { opacity: 0.5, cursor: "default" },
			targetWrap: { position: "relative" },
			targetButton: {
				maxWidth: 320,
				padding: "5px 10px",
				borderRadius: T.radiusMd,
				border: "1px solid " + T.borderL2,
				background: T.bgLayer2,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 12,
				cursor: "pointer",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			badge: { fontSize: 11, fontWeight: 600, letterSpacing: 0.3 },
			/** Stacked label: workspace on top, session title below. */
			stackColumn: {
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				gap: 1,
				maxWidth: 190,
			},
			stackWs: {
				fontSize: 10,
				lineHeight: 1.2,
				color: T.labelTertiary,
				maxWidth: 168,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			stackTitle: {
				fontSize: 11.5,
				lineHeight: 1.3,
				maxWidth: 168,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			badgeLocked: { color: "var(--dsw-alias-state-warn-primary, #e0a500)" },
			badgeSuggested: { color: T.brand },
			badgeAuto: { color: T.labelTertiary },
			picker: {
				position: "absolute",
				top: "calc(100% + 6px)",
				left: 0,
				zIndex: 60,
				minWidth: 300,
				maxWidth: 420,
				maxHeight: 260,
				overflowY: "auto",
				padding: 6,
				borderRadius: T.radiusMd,
				border: "1px solid " + T.borderL2,
				background: T.menuFill,
				boxShadow: T.elevation,
			},
			pickerItem: {
				display: "block",
				width: "100%",
				textAlign: "left",
				padding: "7px 9px",
				borderRadius: 6,
				border: "none",
				background: "transparent",
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 12.5,
				cursor: "pointer",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			pickerFilter: {
				width: "100%",
				boxSizing: "border-box",
				marginBottom: 6,
				padding: "5px 8px",
				borderRadius: 6,
				border: "1px solid " + T.borderL1,
				background: T.bgLayer1,
				color: T.labelPrimary,
				font: "inherit",
				fontSize: 12,
			},
			status: { fontSize: 12, color: T.labelTertiary },
			statusWarn: { fontSize: 11.5, color: "var(--dsw-alias-state-warn-primary, #e0a500)", marginTop: 6 },
			statusError: { fontSize: 12, color: "var(--dsw-alias-state-error-primary, #ff6b6b)" },
			toggle: {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				fontSize: 12,
				color: T.labelSecondary,
				cursor: "pointer",
				userSelect: "none",
			},
			confirm: {
				marginTop: 10,
				padding: "9px 11px",
				borderRadius: T.radiusMd,
				border: "1px solid " + T.brand,
				background: T.active,
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				flexWrap: "wrap",
			},
			confirmText: { fontSize: 12.5, color: T.labelPrimary },
			confirmActions: { display: "inline-flex", alignItems: "center", gap: 10 },
			workspace: {
				border: "1px solid " + T.borderL1,
				borderRadius: T.radiusLg,
				padding: "12px 12px 4px",
				background: T.bgLayer1,
			},
			workspaceHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 },
			workspaceName: {
				fontSize: 13,
				fontWeight: 600,
				color: T.labelPrimary,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			workspaceCount: { fontSize: 11, color: T.labelTertiary, flex: "0 0 auto" },
			session: {
				display: "block",
				width: "100%",
				textAlign: "left",
				padding: "8px 10px",
				marginBottom: 8,
				borderRadius: T.radiusMd,
				border: "1px solid " + T.borderL1,
				background: T.bgLayer2,
				color: T.labelPrimary,
				font: "inherit",
				cursor: "pointer",
				boxSizing: "border-box",
			},
			sessionTitle: { fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
			sessionMeta: {
				fontSize: 10.5,
				color: T.labelTertiary,
				marginTop: 2,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			empty: { fontSize: 13, color: T.labelTertiary },
		};

		/** Sidebar glyph — two solid blocks, bold enough to read at 18px. */
		function OverviewIcon(props) {
			const size = (props && props.size) || 16;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					fill: "currentColor",
					style: { display: "block" },
					"aria-hidden": "true",
				},
				h("rect", { x: 2, y: 2, width: 12, height: 5, rx: 1.4 }),
				h("rect", { x: 2, y: 9, width: 9, height: 5, rx: 1.4 })
			);
		}

		/** Small numeric picker that inherits the theme (no native popup). */
		function Segmented(props) {
			const { value, min, max, onChange, label } = props;
			const numbers = [];
			for (let n = min; n <= max; n++) numbers.push(n);
			return h(
				"div",
				{ style: styles.segmented, role: "group", "aria-label": label },
				numbers.map((n) =>
					h(
						"button",
						{
							key: n,
							type: "button",
							style: n === value ? styles.segmentActive : styles.segment,
							"aria-pressed": n === value,
							onClick: () => onChange(n),
						},
						String(n)
					)
				)
			);
		}

		/** One workspace card holding a grid of its sessions. */
		function WorkspaceCard(props) {
			const { label, sessions, sessionCols, t, open } = props;
			return h(
				"div",
				{ style: styles.workspace },
				h(
					"div",
					{ style: styles.workspaceHead },
					h("div", { style: styles.workspaceName, title: label }, label),
					h("div", { style: styles.workspaceCount }, sessions.length + " " + t("sessionUnit"))
				),
				h(
					"div",
					{ style: grid(sessionCols) },
					sessions.map((row) =>
						h(
							"button",
							{
								key: row.id,
								type: "button",
								style: styles.session,
								onClick: () => open(row.id),
								title: row.id,
							},
							h("div", { style: styles.sessionTitle }, row.title || t("unnamed")),
							h(
								"div",
								{ style: styles.sessionMeta },
								[ago(row.updatedAt, t), typeof row.messageCount === "number" ? row.messageCount + " msgs" : ""]
									.filter(Boolean)
									.join(" · ")
							)
						)
					)
				)
			);
		}

		/** Full-page overview: composer, then workspace cards across and sessions inside. */
		function SessionOverviewPage(props) {
			const t = props.t;
			const sessions = useStore(props.sessions && props.sessions.list);
			const workspaces = useStore(props.workspaces && props.workspaces.list);
			const [layout, setLayout] = React.useState(readLayout);
			const [draft, setDraft] = React.useState("");
			const [pinnedId, setPinnedId] = React.useState(null);
			const [auto, setAuto] = React.useState(null);
			const [pickerOpen, setPickerOpen] = React.useState(false);
			const [busy, setBusy] = React.useState(false);
			const [status, setStatus] = React.useState(null);
			const [ask, setAsk] = React.useState(readAsk);
			const [showWorkspace, setShowWorkspace] = React.useState(readShowWorkspace);
			const [pending, setPending] = React.useState(null);
			const [searchOff, setSearchOff] = React.useState(false);
			const [filter, setFilter] = React.useState("");
			const pickerRef = React.useRef(null);

			const rows = React.useMemo(() => {
				const byId = (sessions && sessions.byId) || {};
				return Object.keys(byId)
					.map((id) => byId[id])
					.filter((row) => row && typeof row === "object")
					.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
					.slice(0, 300);
			}, [sessions]);

			/**
			 * Workspace rows.
			 *
			 * The live snapshot of `ctx.workspaces.list` is a plain array; older shapes
			 * (and the offline fixture) may wrap it as `{ list: [...] }`. Accept both —
			 * reading only one of them silently produced zero workspace labels.
			 */
			const workspaceRows = React.useMemo(() => {
				if (Array.isArray(workspaces)) return workspaces;
				if (workspaces && Array.isArray(workspaces.list)) return workspaces.list;
				return [];
			}, [workspaces]);

			const groups = React.useMemo(() => {
				const list = workspaceRows;
				const map = new Map();
				for (const row of rows) {
					const owner = Array.isArray(list)
						? list.find((workspace) => Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(row.id))
						: undefined;
					const key = (owner && (owner.title || baseName(owner.cwd) || owner.workspaceId)) || baseName(row.cwd) || t("other");
					if (!map.has(key)) map.set(key, []);
					map.get(key).push(row);
				}
				return [...map.entries()].sort((a, b) => (b[1][0]?.updatedAt || 0) - (a[1][0]?.updatedAt || 0));
			}, [rows, workspaces, t]);

			/** session id -> workspace label (same-named workspaces get qualified). */
			const workspaceLabels = React.useMemo(() => buildWorkspaceLabels(workspaceRows), [workspaceRows]);

			/**
			 * Workspace for a row.
			 *
			 * The workspace registry is the primary source, but a session always carries
			 * its own `cwd`, so falling back to its basename keeps the label working even
			 * when the registry snapshot is empty or shaped differently.
			 */
			const workspaceOf = (row) => {
				if (!row) return "";
				const known = workspaceLabels.get(row.id);
				if (known) return known;
				return baseName(row.cwd) || "";
			};

			/**
			 * Two parts, stacked vertically when rendered: workspace on top (muted),
			 * session title below. Concatenating them into one line is what made long
			 * labels swallow the title.
			 */
			const labelParts = (row) => {
				const title = (row && row.title) || t("unnamed");
				const workspace = showWorkspace ? workspaceOf(row) : "";
				return { workspace: workspace || "", title };
			};

			/** Flat label for places that need one string (target chip, confirm strip). */
			const displayTitle = (row) => {
				if (!row) return t("noTarget");
				const parts = labelParts(row);
				return parts.workspace ? parts.title + " · " + parts.workspace : parts.title;
			};

			const target = pinnedId
				? rows.find((row) => row.id === pinnedId) || rows[0]
				: (auto && rows.find((row) => row.id === auto.id)) || rows[0];
			const autoTarget = !pinnedId && auto && target && target.id === auto.id ? auto : null;

			/** Run one search per term and merge the hits (search is literal-phrase based). */
			const searchTerms = async (terms, signal) => {
				let disabled = false;
				const lists = await Promise.all(
					(terms || []).map(async (term) => {
						try {
							if (!props.sessions || typeof props.sessions.search !== "function") return [];
							const result = await props.sessions.search(term, signal);
							if (result && result.ok === false) {
								// SESSION_QUERY_SEARCH_DISABLED: the host has no content index
								disabled = true;
								return [];
							}
							return result ? (result.value && result.value.items) || [] : [];
						} catch (error) {
							return [];
						}
					})
				);
				setSearchOff(disabled);
				return lists.reduce((all, list) => all.concat(list), []);
			};

			// Match the draft text to a session: content search first, local title match otherwise.
			React.useEffect(() => {
				const query = draft.trim();
				if (pinnedId || query.length < 2) {
					setAuto(null);
					return;
				}
				const controller = typeof AbortController === "function" ? new AbortController() : null;
				let cancelled = false;
				const timer = setTimeout(async () => {
					const terms = extractKeywords(query, LIVE_QUERY_LIMIT);
					const items = terms.length ? await searchTerms(terms, controller ? controller.signal : undefined) : [];
					if (cancelled) return;
					const candidates = rankCandidates(query, rows, items);
					setAuto(pickBest(candidates));
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					cancelled = true;
					clearTimeout(timer);
					if (controller) controller.abort();
				};
			}, [draft, pinnedId, rows]);

			const back = () => {
				try {
					if (props.layout && typeof props.layout.selectPanel === "function") props.layout.selectPanel(null);
				} catch (error) {
					/* navigation is optional */
				}
			};

			const open = (id) => {
				try {
					if (props.uiWorkspace && typeof props.uiWorkspace.openSession === "function") props.uiWorkspace.openSession(id);
				} catch (error) {
					/* keep the page alive even if navigation fails */
				}
				back();
			};

			/** Resolve the destination for the current draft, refreshing the match if needed. */
			const resolveTarget = async (text) => {
				// The confirm step can afford more searches than the live preview.
				const terms = extractKeywords(text, CONFIRM_QUERY_LIMIT);
				const items = terms.length ? await searchTerms(terms) : [];
				const best = pickBest(rankCandidates(text, rows, items));
				if (best) {
					setAuto(best);
					const row = rows.find((item) => item.id === best.id);
					return { id: best.id, title: displayTitle(row) || best.title || best.id, reason: best.reason, snippet: best.snippet };
				}
				const fallback = rows[0];
				return { id: fallback.id, title: displayTitle(fallback), reason: "recent", snippet: "" };
			};

			const deliver = async (id, text, title) => {
				setBusy(true);
				setStatus(null);
				try {
					if (!props.sessions || typeof props.sessions.using !== "function") throw new Error("sessions.using unavailable");
					const result = await props.sessions.using(id, { source: "session-overview" }, (reference) =>
						reference.binding.session.prompt([{ type: "text", text }], "queue")
					);
					if (result && result.ok === false) throw new Error((result.error && result.error.message) || "prompt rejected");
					setDraft("");
					setPending(null);
					setStatus({ kind: "ok", text: t("sent") + " · " + (title || id) });
					open(id);
				} catch (error) {
					setStatus({ kind: "err", text: t("sendFailed") + ": " + (error && error.message ? error.message : String(error)) });
				} finally {
					setBusy(false);
				}
			};

			const send = async () => {
				const text = draft.trim();
				if (busy || text === "" || !target) return;
				if (pending) {
					setPending(null);
					await deliver(pending.id, text, pending.title);
					return;
				}
				if (ask && !pinnedId) {
					const confirmed = await resolveTarget(text);
					setPending(confirmed);
					setStatus(null);
					return;
				}
				await deliver(target.id, text, target.title);
			};

			React.useEffect(() => {
				const onKey = (event) => {
					if (event.key !== "Escape") return;
					if (pending) {
						setPending(null);
						return;
					}
					if (pickerOpen) setPickerOpen(false);
					else back();
				};
				const onDown = (event) => {
					const node = pickerRef.current;
					if (!node || !pickerOpen) return;
					if (node.contains && !node.contains(event.target)) setPickerOpen(false);
				};
				window.addEventListener("keydown", onKey);
				if (typeof document !== "undefined") document.addEventListener("mousedown", onDown);
				return () => {
					window.removeEventListener("keydown", onKey);
					if (typeof document !== "undefined") document.removeEventListener("mousedown", onDown);
				};
			}, [pickerOpen, pending]);

			const canSend = !busy && draft.trim() !== "" && !!target;

			return h(
				"div",
				{ style: styles.page },
				h(
					"div",
					{ style: styles.header },
					h("div", { style: styles.title }, t("title")),
					h("button", { type: "button", style: styles.button, onClick: back }, t("back"))
				),
				h("div", { style: styles.hint }, t("hint")),

				h(
					"div",
					{ style: styles.composer },
					h(
						"div",
						{ style: styles.recentRow },
						h("span", { style: styles.recentLabel }, t("recent")),
						rows.slice(0, 6).map((row) => {
							const parts = labelParts(row);
							const stacked = parts.workspace !== "";
							const active = target && row.id === target.id;
							return h(
								"button",
								{
									key: "recent:" + row.id,
									type: "button",
									"data-recent": row.id,
									style: {
										...(active ? styles.recentChipActive : styles.recentChip),
										...(stacked ? styles.stackColumn : {}),
									},
									onClick: () => {
										setPinnedId(row.id);
										setPickerOpen(false);
									},
									title: displayTitle(row),
								},
								stacked
									? [
											h("span", { key: "ws", style: styles.stackWs }, parts.workspace),
											h("span", { key: "title", style: styles.stackTitle }, parts.title),
										]
									: parts.title
							);
						})
					),
					h(
						"div",
						{ style: styles.composerHead },
						h("div", { style: styles.composerLabel }, t("composerLabel")),
						h(
							"div",
							{ style: styles.targetWrap, ref: pickerRef },
							h(
								"button",
								{
									type: "button",
									style: styles.targetButton,
									onClick: () => {
										setPickerOpen((value) => !value);
										setFilter("");
									},
									title: target ? displayTitle(target) : t("noTarget"),
								},
								h(
									"span",
									{ style: { ...styles.badge, ...(pinnedId ? styles.badgeLocked : autoTarget ? styles.badgeSuggested : styles.badgeAuto) } },
									pinnedId ? t("locked") : autoTarget ? t("recommended") : t("autoMode")
								),
								" · " + displayTitle(target) + " ▾"
							),
							pickerOpen &&
								h(
									"div",
									{ style: styles.picker, role: "listbox" },
									h("input", {
										style: styles.pickerFilter,
										value: filter,
										placeholder: t("filterPlaceholder"),
										onChange: (event) => setFilter(event.target.value),
									}),
									[
										h(
											"button",
											{
												key: "__auto",
												type: "button",
												style: styles.pickerItem,
												role: "option",
												"aria-selected": !pinnedId,
												onClick: () => {
													setPinnedId(null);
													setPickerOpen(false);
												},
											},
											t("auto")
										),
									].concat(
										rows
											.filter((row) => {
												const q = filter.trim().toLowerCase();
												if (!q) return true;
												const haystack = (displayTitle(row) + " " + (row.cwd || "")).toLowerCase();
												return haystack.includes(q);
											})
											.map((row) => {
											const parts = labelParts(row);
											const stacked = parts.workspace !== "";
											return h(
												"button",
												{
													key: row.id,
													type: "button",
													style: { ...styles.pickerItem, ...(stacked ? styles.stackColumn : {}) },
													role: "option",
													"aria-selected": row.id === (target && target.id),
													onClick: () => {
														setPinnedId(row.id);
														setPickerOpen(false);
													},
													title: displayTitle(row),
												},
												stacked
													? [
															h("span", { key: "ws", style: styles.stackWs }, parts.workspace),
															h("span", { key: "title", style: styles.stackTitle }, parts.title),
														]
													: parts.title
											);
										})
									)
								)
						)
					),
					h("textarea", {
						style: styles.textarea,
						value: draft,
						placeholder: t("composerPlaceholder"),
						onChange: (event) => {
							setDraft(event.target.value);
							setStatus(null);
							setPending(null);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								send();
							}
						},
					}),
					h(
						"div",
						{ style: styles.composerRow },
						h(
							"button",
							{
								type: "button",
								style: canSend ? styles.primary : { ...styles.primary, ...styles.primaryDisabled },
								disabled: !canSend,
								onClick: send,
							},
							busy ? t("sending") : pending ? t("confirm") : t("send")
						),
						h(
							"label",
							{ style: styles.toggle },
							h("input", {
								type: "checkbox",
								checked: ask,
								style: { accentColor: T.brand, cursor: "pointer" },
								onChange: (event) => {
									const next = event.target.checked;
									setAsk(next);
									saveAsk(next);
									if (!next) setPending(null);
								},
							}),
							t("askLabel")
						),
						h(
							"label",
							{ style: styles.toggle, title: t("showWorkspaceHint") },
							h("input", {
								type: "checkbox",
								checked: showWorkspace,
								style: { accentColor: T.brand, cursor: "pointer" },
								onChange: (event) => {
									const next = event.target.checked;
									setShowWorkspace(next);
									saveShowWorkspace(next);
								},
							}),
							t("showWorkspace")
						),
						status
							? h("div", { style: status.kind === "err" ? styles.statusError : styles.status }, status.text)
							: pinnedId
								? h("div", { style: styles.status }, t("lockedHint"))
								: autoTarget
									? h(
											"div",
											{ style: styles.status },
											reasonText(autoTarget.reason, t) + (autoTarget.snippet ? " · " + autoTarget.snippet : "")
										)
									: draft.trim().length >= 2
										? h("div", { style: styles.status }, t("autoFallback"))
										: null
					),
					searchOff && h("div", { style: styles.statusWarn }, t("searchOff")),
					pending &&
						h(
							"div",
							{ style: styles.confirm },
							h(
								"div",
								{ style: styles.confirmText },
								t("confirmTo") + " " + (pending.title || pending.id) + " · " + reasonText(pending.reason, t)
							),
							h(
								"div",
								{ style: styles.confirmActions },
								h("span", { style: styles.status }, t("confirmHint")),
								h(
									"button",
									{
										type: "button",
										style: styles.button,
										onClick: () => setPending(null),
									},
									t("cancel")
								)
							)
						)
				),

				h(
					"div",
					{ style: styles.toolbar },
					h(
						"label",
						{ style: styles.field },
						t("perRow"),
						h(Segmented, {
							value: layout.workspaceCols,
							min: 1,
							max: 4,
							label: t("workspaceUnit"),
							onChange: (n) => {
								const next = { ...layout, workspaceCols: n };
								setLayout(next);
								saveLayout(next);
							},
						}),
						t("workspaceUnit")
					),
					h(
						"label",
						{ style: styles.field },
						t("perRow"),
						h(Segmented, {
							value: layout.sessionCols,
							min: 1,
							max: 6,
							label: t("sessionUnit"),
							onChange: (n) => {
								const next = { ...layout, sessionCols: n };
								setLayout(next);
								saveLayout(next);
							},
						}),
						t("sessionUnit")
					)
				),

				rows.length === 0
					? h("div", { style: styles.empty }, t("empty"))
					: h(
							"div",
							{ style: grid(layout.workspaceCols) },
							groups.map(([label, items]) =>
								h(WorkspaceCard, {
									key: "group:" + label,
									label,
									sessions: items,
									sessionCols: layout.sessionCols,
									t,
									open,
								})
							)
						)
			);
		}

		/** Register one sidebar row plus its full-page panel. */
		function apply(ctx) {
			if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;

			if (ctx.locale && typeof ctx.locale.register === "function") {
				const register = () => ctx.locale.register(NS, DICT);
				if (typeof ctx.effect === "function") ctx.effect(register, "session-overview: dictionaries");
				else register();
			}

			const t = ctx.locale && typeof ctx.locale.bind === "function" ? ctx.locale.bind(NS) : (key) => DICT.zh[key] || key;

			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
						inject: () => ({
							sessions: ctx.sessions,
							workspaces: ctx.workspaces,
							uiWorkspace: ctx.uiWorkspace,
							layout: ctx.layout,
							t,
						}),
					},
					SessionOverviewPage
				)
			);

			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 20,
						locale: NS,
						label: () => t("panel"),
					},
					OverviewIcon
				)
			);
		}

		exports.PANEL_ID = PANEL_ID;
		exports.apply = apply;
		exports.inject = inject;
		/** Pure helpers exposed for the offline test harness. */
		exports.__test = { normalize, bigrams, overlapScore, rankCandidates, pickBest, buildWorkspaceLabels, extractKeywords, splitClauses };
		return module.exports;
	},
});
