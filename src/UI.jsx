import React from "react";
import {
  Users,
  CalendarBlank,
  FileText,
  Briefcase,
  MagnifyingGlass,
  Plus,
  CaretDown,
  ArrowRight,
  ArrowUpRight,
  X,
  CheckCircle,
  Clock,
  Paperclip,
  NotePencil,
  EnvelopeSimple,
  VideoCamera,
  Buildings,
  Sparkle,
  ArrowClockwise,
  LinkSimple,
  Database,
  WarningCircle,
  MapPin,
  Phone,
  CalendarCheck,
} from "@phosphor-icons/react";
export const I = {
  Users,
  CalendarBlank,
  FileText,
  Briefcase,
  MagnifyingGlass,
  Plus,
  CaretDown,
  ArrowRight,
  ArrowUpRight,
  X,
  CheckCircle,
  Clock,
  Paperclip,
  NotePencil,
  EnvelopeSimple,
  VideoCamera,
  Buildings,
  Sparkle,
  ArrowClockwise,
  LinkSimple,
  Database,
  WarningCircle,
  MapPin,
  Phone,
  CalendarCheck,
};
export function Button({
  children,
  icon,
  onClick,
  kind = "",
  type = "button",
  ...rest
}) {
  const Icon = icon;
  return (
    <button
      type={type}
      className={"button " + kind}
      onClick={onClick}
      {...rest}
    >
      {Icon && <Icon size={18} />}
      <span>{children}</span>
    </button>
  );
}
export function Badge({ children, tone = "" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Empty({ title, body, action }) {
  return (
    <div className="empty">
      <MagnifyingGlass size={30} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function Resume({ p, text }) {
  return (
    <>
      <div className="resume-identity">
        <div className="resume-name">{p.name}</div>
        <p>
          {p.role}
          <span className="middot">·</span>
          {p.years}
          <span className="middot">·</span>
          {p.degree}
        </p>
        <div className="contactline">
          <span>
            <MapPin size={14} />
            {p.city}
          </span>
          {p.phone && (
            <span>
              <Phone size={14} />
              {p.phone}
            </span>
          )}
          {p.email && (
            <span>
              <EnvelopeSimple size={14} />
              {p.email}
            </span>
          )}
        </div>
      </div>
      {p.summary && (
        <div className="resume-section">
          <h4>候选人概况</h4>
          <p className="resume-text">{p.summary}</p>
        </div>
      )}
      <div className="resume-section">
        <h4>简历正文</h4>
        <div className="resume-text">
          {text || "来源库暂未提供简历正文，可查看原附件或记录待补充事项。"}
        </div>
      </div>
      {p.major && (
        <div className="resume-section">
          <h4>专业</h4>
          <p>
            {p.major} · {p.degree}
          </p>
        </div>
      )}
      {p.tags.length > 0 && (
        <div className="resume-section">
          <h4>专业技能</h4>
          <div className="tags">
            {p.tags.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
