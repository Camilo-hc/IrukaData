import type { RulesInput } from '../../domain/rules/configuration'
import type { RulesSnapshot } from '../../domain/rules/contracts'
import type { FieldErrors } from '../../domain/shared/validation'

export function RulesFields({ input, onChange, fields }: { input: RulesInput; onChange: (value: RulesInput) => void; fields: FieldErrors | undefined }) {
  return <fieldset className="match-rules"><legend>Reglas del partido</legend>
    <p>Mejor de 3 sets · 25/25/15 puntos · 2 de ventaja. Es una variante de torneo. Confirma los límites en sus bases.</p>
    <div className="form-grid">
      <div className="field"><label htmlFor="match-substitutions">Sustituciones oficiales por set</label><input id="match-substitutions" inputMode="numeric" value={input.substitutionLimit} onChange={(event) => onChange({ ...input, substitutionLimit: event.target.value })} required aria-invalid={Boolean(fields?.substitutionLimit)} aria-describedby="match-substitutions-error" /><span id="match-substitutions-error" className="field-error">{fields?.substitutionLimit}</span></div>
      <div className="field"><label htmlFor="match-min-liberos">Mínimo de líberos designados</label><select id="match-min-liberos" value={input.minimumLiberos} onChange={(event) => onChange({ ...input, minimumLiberos: event.target.value })} aria-invalid={Boolean(fields?.minimumLiberos)} aria-describedby="match-min-liberos-error">{[0, 1, 2].map((number) => <option key={number} value={number}>{number}</option>)}</select><span id="match-min-liberos-error" className="field-error">{fields?.minimumLiberos}</span></div>
      <div className="field"><label htmlFor="match-max-liberos">Máximo de líberos designados</label><select id="match-max-liberos" value={input.maximumLiberos} onChange={(event) => onChange({ ...input, maximumLiberos: event.target.value })} aria-invalid={Boolean(fields?.maximumLiberos)} aria-describedby="match-max-liberos-error">{[0, 1, 2].map((number) => <option key={number} value={number}>{number}</option>)}</select><span id="match-max-liberos-error" className="field-error">{fields?.maximumLiberos}</span></div>
      <div className="field"><label htmlFor="match-libero-threshold">Exigir 2 líberos si la convocatoria supera (opcional)</label><input id="match-libero-threshold" inputMode="numeric" placeholder="Por ejemplo, 12" value={input.twoLiberosAbove} onChange={(event) => onChange({ ...input, twoLiberosAbove: event.target.value })} aria-invalid={Boolean(fields?.twoLiberosAbove)} aria-describedby="match-libero-threshold-error match-libero-threshold-help" /><span id="match-libero-threshold-error" className="field-error">{fields?.twoLiberosAbove}</span><span className="field-hint" id="match-libero-threshold-help">Déjalo vacío si el torneo no exige esta condición.</span></div>
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={input.decidingSideChange} onChange={(event) => onChange({ ...input, decidingSideChange: event.target.checked })} />Avisar cambio de lado a los 8 puntos del tercer set</label>
    <p className="catalog-help">Estas reglas se guardan con este partido. La ejecución de sustituciones y reemplazos se incorporará más adelante; no incluye situaciones excepcionales.</p>
  </fieldset>
}

export function RulesSummary({ rules }: { rules: RulesSnapshot }) {
  return <section className="rules-summary" aria-label="Reglas guardadas del partido"><h2>Reglas del partido</h2><p>{rules.label} · 25/25/15 · 2 puntos de ventaja</p>
    <dl className="profile-fields">
      <div><dt>Sustituciones oficiales</dt><dd>{rules.officialSubstitutions.limitPerSet} por set</dd></div>
      <div><dt>Líberos designados</dt><dd>Mínimo {rules.libero.minimumDesignated} · máximo {rules.libero.maximumDesignated}</dd></div>
      <div><dt>Exigencia de dos líberos</dt><dd>{rules.libero.twoRequiredAboveRosterSize === null ? 'Sin umbral adicional' : `Si la convocatoria supera ${rules.libero.twoRequiredAboveRosterSize} deportistas`}</dd></div>
      <div><dt>Cambio de lado en el tercer set</dt><dd>{rules.format.decidingSetSideChangeAt === null ? 'Sin aviso' : `Aviso a los ${rules.format.decidingSetSideChangeAt} puntos`}</dd></div>
    </dl>
  </section>
}
