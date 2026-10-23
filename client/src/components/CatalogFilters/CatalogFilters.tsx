import type { Level, Topic } from '../../shared/api/types';
import { LEVEL_LABEL } from '../../shared/lib/format';
import styles from './CatalogFilters.module.css';

interface CatalogFiltersProps {
  search: string;
  level: Level | '';
  topic: number | null;
  topics: Topic[];
  onSearchChange: (value: string) => void;
  onLevelChange: (value: Level | '') => void;
  onTopicChange: (value: number | null) => void;
}

export function CatalogFilters({
  search,
  level,
  topic,
  topics,
  onSearchChange,
  onLevelChange,
  onTopicChange,
}: CatalogFiltersProps) {
  return (
    <div className={`glassPanel ${styles.filters}`}>
      <input
        className="field"
        type="search"
        placeholder="Пошук за назвою або описом"
        aria-label="Пошук курсів"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="field"
        aria-label="Рівень"
        value={level}
        onChange={(e) => onLevelChange(e.target.value as Level | '')}
      >
        <option value="">Усі рівні</option>
        {Object.entries(LEVEL_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="field"
        aria-label="Тема"
        value={topic ?? ''}
        onChange={(e) => onTopicChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">Усі теми</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
