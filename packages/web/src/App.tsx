import { EXAMPLE_WODS } from '@wod-translator/shared';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.app}>
      <h1>WOD Translator</h1>
      <p>
        Esqueleto del proyecto. Ejemplos de demostración cargados desde{' '}
        <code>@wod-translator/shared</code>: {EXAMPLE_WODS.length}.
      </p>
      <ul>
        {EXAMPLE_WODS.map((example) => (
          <li key={example.id}>{example.label}</li>
        ))}
      </ul>
    </main>
  );
}
