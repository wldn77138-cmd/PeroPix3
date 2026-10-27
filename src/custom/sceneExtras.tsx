/** 내 판(포크)에만 있는 씬 칸 기능 — 원본 파일들은 이것을 부르는 몇 줄만 갖는다.
 *
 *  ★원본과 부딪히는 자리를 줄이려고 따로 둔다. 원본 쪽 연결점은 셋이다:
 *    `panels/SceneLane.tsx`(씬 머리에 썸네일 · 머리줄의 「최신 장 고르기」) ·
 *    `App.tsx`(위치 잡는 창이 끝나면 씬에 건다) · `cards/thumbAsk.ts`(`scene-cell` 갈래).
 *  ★그림은 공용 고정 썸네일(`/api/pin/<tid>`, 긴 변 512)이다 — 원본을 지워도 남는다.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { useDropZone } from "../cards/dragStore";
import { askThumb } from "../cards/thumbAsk";
import { FittedImg } from "../cards/FittedImg";
import { useGen } from "../store/gen";
import { useSceneFocus } from "../store/sceneFocus";
import { toast } from "../store/toast";
import { newestFirst } from "../lib/takes";
import type { Rec, SceneCard, Slot } from "../store/workspace";

const pinUrl = (base: string, tid: string) => `${base}/api/pin/${tid}`;

/** 씬 머리 안에서 그림을 받는 자리 + 걸린 그림.
 *  ★받는 자리는 **머리 전체**다 (`position: absolute` 겹 — 머리가 sticky 라 그것이 기준이 된다).
 *    그림이 없을 때도 끌어다 놓을 수 있어야 하므로 겹은 언제나 있고, 끌고 있을 때만 테두리가 보인다. */
export function SceneThumb({
  groupId,
  cardId,
  cell,
  w,
  h,
  onClear,
}: {
  groupId: string;
  cardId: string;
  cell: Slot;
  w: number;
  h: number;
  onClear: () => void;
}) {
  const base = useGen((s) => s.base);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const drop = useDropZone({
    id: `scene-cell-thumb-${cell.id}`,
    kind: "image",
    dir: "image",
    prio: 7,
    onDrop: (d) => d.img && askThumb({ type: "scene-cell", groupId, cardId, cellId: cell.id, img: d.img }),
  });
  const t = cell.thumb;
  const big = 280;
  return (
    <>
      <div
        ref={drop.ref}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 4,
          borderRadius: "var(--r-1)",
          outline: drop.over ? "2px solid var(--accent)" : undefined,
          outlineOffset: -2,
          background: drop.active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
        }}
      />
      {t && (
        <div
          data-scene-thumb={cell.id}
          onClick={(e) => e.stopPropagation()}
          onPointerEnter={(e) => setHover(e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          style={{
            position: "relative",
            flexShrink: 0,
            width: w,
            height: h,
            borderRadius: "var(--r-1)",
            overflow: "hidden",
            border: "1px solid var(--line)",
            background: "var(--bg)",
          }}
        >
          <FittedImg url={pinUrl(base, t.tid)} w={w} h={h} view={t.view} />
          {hover && (
            <button
              data-scene-thumb-clear
              onClick={(e) => {
                e.stopPropagation();
                setHover(null);
                onClear();
              }}
              data-tip="씬 썸네일 빼기"
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                border: "none",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontSize: 11,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
      {t &&
        hover &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: hover.right + 8,
              top: Math.max(8, Math.min(hover.top + hover.height / 2 - big / 2, innerHeight - big - 8)),
              width: Math.round((big * w) / h),
              height: big,
              zIndex: 8500,
              pointerEvents: "none",
              borderRadius: "var(--r-2)",
              overflow: "hidden",
              border: "1px solid var(--line-strong)",
              boxShadow: "var(--shadow-3)",
              background: "var(--bg)",
            }}
          >
            <FittedImg url={pinUrl(base, t.tid)} w={Math.round((big * w) / h)} h={big} view={t.view} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** 카드째 잠기지 않은 씬 카드의 **모든 씬**에서 가장 최근 장 하나씩을 고른다 (씬 하나하나의 잠금은 안 본다).
 *  ★고른 상태는 손으로 Ctrl+클릭한 것과 같다 — 큰 그림 아래의 보내기·삭제가 그대로 고른 것 전부에 걸린다. */
export function pickLatest(cards: SceneCard[], takesOf: (c: Slot) => Rec[]) {
  const got: { cell: string; file: string }[] = [];
  for (const k of cards) {
    if (k.locked) continue;
    for (const c of k.cells) {
      const top = [...takesOf(c)].sort(newestFirst)[0];
      if (top) got.push({ cell: c.id, file: top.file });
    }
  }
  if (!got.length) {
    toast("켜진 씬 카드에 고를 그림이 없습니다", "warn");
    return;
  }
  const f = useSceneFocus.getState();
  f.setPicked(got.map((x) => x.file));
  f.focus(got[0].cell, got[0].file);
  toast(`켜진 카드에서 최신 장 ${got.length}장을 골랐습니다`);
}
