import { CROPS, type CropKey } from '../types';
import { useI18n } from '../i18n';

interface Props {
  multiple: boolean;
  value: CropKey[];
  onChange: (v: CropKey[]) => void;
}

/** Big tappable crop buttons. Single-select for farmers, multi-select for owners. */
export default function CropPicker({ multiple, value, onChange }: Props) {
  const { t } = useI18n();
  const toggle = (c: CropKey) => {
    if (!multiple) return onChange([c]);
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  };
  return (
    <div className="chips">
      {CROPS.map((c) => (
        <button type="button" key={c} className={value.includes(c) ? 'chip on' : 'chip'}
          aria-pressed={value.includes(c)} onClick={() => toggle(c)}>
          {value.includes(c) ? '✓ ' : ''}{t(`crop_${c}`)}
        </button>
      ))}
    </div>
  );
}
