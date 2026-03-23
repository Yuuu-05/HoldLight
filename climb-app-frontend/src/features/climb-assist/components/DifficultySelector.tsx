import Button from '../../../shared/components/ui/Button';

interface DifficultySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const levels = ['Beginner', 'Intermediate', 'Advanced'];

export default function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  return (
    <div className="segmented-control assist-difficulty-selector" role="group" aria-label="Choose guidance difficulty">
      {levels.map((level) => (
        <Button key={level} variant={value === level ? 'primary' : 'secondary'} onClick={() => onChange(level)}>
          {level}
        </Button>
      ))}
    </div>
  );
}
