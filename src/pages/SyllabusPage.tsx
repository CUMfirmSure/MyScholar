import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { TopicStatus } from "../types";
import { cn } from "../utils/cn";
import { Glass, PressButton, Stagger, StaggerItem } from "../components/ui";

const NEXT: Record<TopicStatus, TopicStatus> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

const LABEL: Record<TopicStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

export function SyllabusPage() {
  const { state, openSheet, setTopicStatus, deleteTopic, deleteUnit, askConfirm } = useApp();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") || state.courses[0]?.id || "";
  const course = state.courses.find((c) => c.id === courseId);
  const units = state.units.filter((u) => u.courseId === courseId).sort((a, b) => a.order - b.order);
  const topics = state.topics.filter((t) => t.courseId === courseId);
  const done = topics.filter((t) => t.status === "done").length;
  const partial = topics.filter((t) => t.status === "in_progress").length;
  const pct = topics.length ? Math.round(((done + partial * 0.5) / topics.length) * 100) : 0;
  const grouped = useMemo(() => units.map((unit) => ({ unit, topics: topics.filter((t) => t.unitId === unit.id).sort((a, b) => a.order - b.order) })), [units, topics]);

  return (
    <div className="page">
      <p className="kicker text-[#c4b8ff]">Syllabus</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Topics</h1>
      {!state.courses.length ? <p className="mt-4 text-sm text-white/60">Add a course before tracking a syllabus.</p> : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {state.courses.map((c) => (
              <button key={c.id} type="button" onClick={() => setParams({ course: c.id })} className={cn("press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", c.id === courseId ? "bg-white text-[#14141c]" : "bg-white/5 text-white/70")}>
                {c.code}
              </button>
            ))}
          </div>
          {course ? (
            <Glass className="mt-4 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-white/60">{course.name}</p>
                  <p className="text-lg font-semibold">{done}/{topics.length || 0} done</p>
                </div>
                <p className="text-sm tabular-nums text-white/50">{pct}%</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#7b6cff] to-[#c4b8ff]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </Glass>
          ) : null}
          <PressButton className="btn btn-primary mt-4 w-full" onClick={() => openSheet({ kind: "topics", courseId })}>Add topics</PressButton>
          <Stagger className="mt-4 space-y-3">
            {grouped.map(({ unit, topics: unitTopics }) => {
              const unitDone = unitTopics.filter((t) => t.status === "done").length;
              const unitPct = unitTopics.length ? Math.round((unitDone / unitTopics.length) * 100) : 0;
              return (
                <StaggerItem key={unit.id}>
                  <Glass className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{unit.name}</p>
                        <p className="text-xs text-white/55">{unitDone}/{unitTopics.length} done · {unitPct}%</p>
                      </div>
                      <button type="button" aria-label="Delete unit" className="text-white/45" onClick={() => askConfirm({ title: "Remove unit?", body: `${unit.name} and its topics will be deleted.`, confirmLabel: "Remove unit", danger: true, onConfirm: () => deleteUnit(unit.id) })}><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${unitPct}%`, background: course?.color ?? "#7b6cff" }} />
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {unitTopics.map((topic) => (
                        <div key={topic.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTopicStatus(topic.id, NEXT[topic.status])}
                            className={cn(
                              "press rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                              topic.status === "done" && "bg-emerald-400/15 text-emerald-200",
                              topic.status === "in_progress" && "bg-[#7b6cff]/20 text-[#d6ccff]",
                              topic.status === "pending" && "bg-white/5 text-white/60",
                            )}
                          >
                            {LABEL[topic.status]}
                          </button>
                          <p className={cn("min-w-0 flex-1 text-sm", topic.status === "done" && "text-white/55 line-through")}>{topic.title}</p>
                          <button type="button" aria-label="Delete topic" className="text-white/25" onClick={() => deleteTopic(topic.id)}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      {!unitTopics.length ? <p className="text-xs text-white/45">No topics in this unit.</p> : null}
                    </div>
                  </Glass>
                </StaggerItem>
              );
            })}
          </Stagger>
          {!grouped.length ? <p className="mt-6 text-sm text-white/55">No units yet. Paste a topic list to start {course?.code}.</p> : null}
        </>
      )}
    </div>
  );
}
