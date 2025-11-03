import React from "react";
import "./ActionMenu.css";

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  prompt: string;
  mode: "send" | "prefill";
  preserveInput?: boolean;
}

interface ActionMenuProps {
  open: boolean;
  actions: QuickAction[];
  loading?: boolean;
  onToggle: () => void;
  onSelect: (action: QuickAction) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  open,
  actions,
  loading = false,
  onToggle,
  onSelect,
}) => {
  return (
    <div className={`channel-menu ${open ? "open" : ""}`}>
      <button
        type="button"
        className="channel-menu-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="channel-menu-label">AI 도우미 메뉴</span>
        <span className={`chevron ${open ? "open" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="action-card-row" role="list">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="action-card"
              onClick={() => onSelect(action)}
              disabled={loading}
            >
              <span className="action-icon" aria-hidden="true">
                {action.icon}
              </span>
              <span className="action-copy">
                <span className="action-label">{action.label}</span>
                <span className="action-description">{action.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
