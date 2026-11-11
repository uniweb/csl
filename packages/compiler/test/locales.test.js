/**
 * Formatting in a locale pack: the style's terms, ordinals, dates, quotes and punctuation in the
 * pack's language, with CSL 1.0.2's fallback (en-US < pack < the style's own <locale> elements).
 */
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import { compile } from '../src/compile.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPacks } from '../../locales/generate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')
const { packs } = buildPacks()

async function compileAndEval(cslXml, options) {
  const { code } = compile(cslXml, options)
  const corePath = join(__dirname, '..', '..', 'core', 'src', 'index.js')
  const tmpDir = join(__dirname, '..', '..', '..', 'test', '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `locale-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, code.replace("'@citestyle/core'", `'${corePath}'`))
  return import(tmpFile)
}

// ── Fixtures: "and", "et al.", editors, edition, volume, issue, pages, "In", accessed/retrieved,
// month names, quotes and punctuation-in-quote ────────────────────────────────────────────────

const items = {
  article: {
    id: 'article', type: 'article-journal', title: 'Neural correlates of consciousness',
    author: [{ family: 'Smith', given: 'John Andrew' }, { family: 'Jones', given: 'Barbara Carol' }, { family: 'Brown', given: 'Charles' }],
    issued: { 'date-parts': [[2024, 3]] }, 'container-title': 'Nature Neuroscience', volume: '27', issue: '3', page: '45-67', DOI: '10.1038/nn.2024',
  },
  book: {
    id: 'book', type: 'book', title: 'The design of everyday things',
    author: [{ family: 'Norman', given: 'Donald' }, { family: 'Draper', given: 'Stephen' }, { family: 'Lewis', given: 'Clayton' }, { family: 'Rhodes', given: 'Diane' }, { family: 'Grudin', given: 'Jonathan' }, { family: 'Zhang', given: 'Wei' }, { family: 'Kay', given: 'Alan' }, { family: 'Hutchins', given: 'Edwin' }],
    issued: { 'date-parts': [[2013]] }, publisher: 'Basic Books', 'publisher-place': 'New York', edition: '2', volume: '3',
  },
  chapter: {
    id: 'chapter', type: 'chapter', title: 'Deep learning fundamentals', author: [{ family: 'LeCun', given: 'Yann' }],
    editor: [{ family: 'Goodfellow', given: 'Ian' }, { family: 'Bengio', given: 'Yoshua' }],
    issued: { 'date-parts': [[2016]] }, 'container-title': 'Deep learning', publisher: 'MIT Press', 'publisher-place': 'Cambridge', page: '145-189', edition: '1',
  },
  webpage: {
    id: 'webpage', type: 'webpage', title: 'How to cite a web page', author: [{ family: 'Writer', given: 'Wendy' }],
    'container-title': 'Example Site', URL: 'https://example.org/cite', accessed: { 'date-parts': [[2024, 2, 1]] },
  },
}

// Each style's text, with no locale (its default, en-US) and in the fr-FR, de-DE and es-ES packs.
// Exactly as the locale files write them: French « » carry no-break spaces ( ) and its page
// ranges a non-breaking hyphen (‑); "et al." in Spanish and "u. a." in German, a no-break
// space. In US English a period goes inside the closing quote; in French, German and Spanish not.
const EXPECTED = {
  'apa': {
    'none': {
      article: 'Smith, J. A., Jones, B. C., & Brown, C. (2024). Neural correlates of consciousness. Nature Neuroscience, 27(3), 45\u201367. https://doi.org/10.1038/nn.2024',
      book: 'Norman, D., Draper, S., Lewis, C., Rhodes, D., Grudin, J., Zhang, W., Kay, A., & Hutchins, E. (2013). The design of everyday things (2nd ed., Vol. 3). Basic Books.',
      chapter: 'LeCun, Y. (2016). Deep learning fundamentals. In I. Goodfellow & Y. Bengio (Eds.), Deep learning (1st ed., pp. 145\u2013189). MIT Press.',
      webpage: 'Writer, W. (n.d.). How to cite a web page. Example Site. Retrieved February 1, 2024, from https://example.org/cite',
      cite: '(Smith et al., 2024; Norman et al., 2013)',
    },
    'fr-FR': {
      article: 'Smith, J. A., Jones, B. C., & Brown, C. (2024). Neural correlates of consciousness. Nature Neuroscience, 27(3), 45\u201167. https://doi.org/10.1038/nn.2024',
      book: 'Norman, D., Draper, S., Lewis, C., Rhodes, D., Grudin, J., Zhang, W., Kay, A., & Hutchins, E. (2013). The design of everyday things (2ᵉ éd., Vol. 3). Basic Books.',
      chapter: 'LeCun, Y. (2016). Deep learning fundamentals. In I. Goodfellow & Y. Bengio (Éds.), Deep learning (1ʳᵉ éd., p. 145\u2011189). MIT Press.',
      webpage: 'Writer, W. (s.\u00a0d.). How to cite a web page. Example Site. Consulté 1 février 2024, à l\'adresse https://example.org/cite',
      cite: '(Smith et al., 2024; Norman et al., 2013)',
    },
    'de-DE': {
      article: 'Smith, J. A., Jones, B. C., & Brown, C. (2024). Neural correlates of consciousness. Nature Neuroscience, 27(3), 45\u201367. https://doi.org/10.1038/nn.2024',
      book: 'Norman, D., Draper, S., Lewis, C., Rhodes, D., Grudin, J., Zhang, W., Kay, A., & Hutchins, E. (2013). The design of everyday things (2. Aufl., Bd. 3). Basic Books.',
      chapter: 'LeCun, Y. (2016). Deep learning fundamentals. In I. Goodfellow & Y. Bengio (Hrsg.), Deep learning (1. Aufl., S. 145\u2013189). MIT Press.',
      webpage: 'Writer, W. (o.\u00a0J.). How to cite a web page. Example Site. Abgerufen 1. Februar 2024, von https://example.org/cite',
      cite: '(Smith et al., 2024; Norman et al., 2013)',
    },
    'es-ES': {
      article: 'Smith, J. A., Jones, B. C., & Brown, C. (2024). Neural correlates of consciousness. Nature Neuroscience, 27(3), 45-67. https://doi.org/10.1038/nn.2024',
      book: 'Norman, D., Draper, S., Lewis, C., Rhodes, D., Grudin, J., Zhang, W., Kay, A., & Hutchins, E. (2013). The design of everyday things (2.ª ed., Vol. 3). Basic Books.',
      chapter: 'LeCun, Y. (2016). Deep learning fundamentals. En I. Goodfellow & Y. Bengio (Eds.), Deep learning (1.ª ed., pp. 145-189). MIT Press.',
      webpage: 'Writer, W. (s.\u00a0f.). How to cite a web page. Example Site. Recuperado 1 de febrero de 2024, de https://example.org/cite',
      cite: '(Smith et\u00a0al., 2024; Norman et\u00a0al., 2013)',
    },
  },
  'mla': {
    'none': {
      article: 'Smith, John Andrew, et al. \u201cNeural Correlates of Consciousness.\u201d Nature Neuroscience, vol. 27, no. 3, Mar. 2024, pp. 45\u201367, https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, et al. The Design of Everyday Things. 2nd ed., vol. 3, Basic Books, 2013.',
      chapter: 'LeCun, Yann. \u201cDeep Learning Fundamentals.\u201d Deep Learning, edited by Ian Goodfellow and Yoshua Bengio, 1st ed., MIT Press, 2016, pp. 145\u201389.',
      webpage: 'Writer, Wendy. \u201cHow to Cite a Web Page.\u201d Example Site, https://example.org/cite. Accessed 1 Feb. 2024.',
      cite: '(Smith et al.; Norman et al.)',
    },
    'fr-FR': {
      article: 'Smith, John Andrew, et al. «\u00a0Neural Correlates of Consciousness\u00a0». Nature Neuroscience, vol. 27, nᵒ 3, mars 2024, p. 45\u201167, https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, et al. The Design of Everyday Things. 2ᵉ éd., vol. 3, Basic Books, 2013.',
      chapter: 'LeCun, Yann. «\u00a0Deep Learning Fundamentals\u00a0». Deep Learning, édité par Ian Goodfellow et Yoshua Bengio, 1ʳᵉ éd., MIT Press, 2016, p. 145\u201189.',
      webpage: 'Writer, Wendy. «\u00a0How to Cite a Web Page\u00a0». Example Site, https://example.org/cite. Consulté le 1 février 2024.',
      cite: '(Smith et al.; Norman et al.)',
    },
    'de-DE': {
      article: 'Smith, John Andrew, u.\u00a0a. \u201eNeural Correlates of Consciousness\u201c. Nature Neuroscience, Bd. 27, Nr. 3, März 2024, S. 45\u201367, https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, u.\u00a0a. The Design of Everyday Things. 2. Aufl., Bd. 3, Basic Books, 2013.',
      chapter: 'LeCun, Yann. \u201eDeep Learning Fundamentals\u201c. Deep Learning, herausgegeben von Ian Goodfellow und Yoshua Bengio, 1. Aufl., MIT Press, 2016, S. 145\u201389.',
      webpage: 'Writer, Wendy. \u201eHow to Cite a Web Page\u201c. Example Site, https://example.org/cite. Zugegriffen 1. Februar 2024.',
      cite: '(Smith u.\u00a0a.; Norman u.\u00a0a.)',
    },
    'es-ES': {
      article: 'Smith, John Andrew, et\u00a0al. «Neural Correlates of Consciousness». Nature Neuroscience, vol. 27, n.º 3, marzo de 2024, pp. 45-67, https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, et\u00a0al. The Design of Everyday Things. 2.ª ed., vol. 3, Basic Books, 2013.',
      chapter: 'LeCun, Yann. «Deep Learning Fundamentals». Deep Learning, editado por Ian Goodfellow y Yoshua Bengio, 1.ª ed., MIT Press, 2016, pp. 145-89.',
      webpage: 'Writer, Wendy. «How to Cite a Web Page». Example Site, https://example.org/cite. Accedido 1 de febrero de 2024.',
      cite: '(Smith et\u00a0al.; Norman et\u00a0al.)',
    },
  },
  'chicago-author-date': {
    'none': {
      article: 'Smith, John Andrew, Barbara Carol Jones, and Charles Brown. 2024. \u201cNeural Correlates of Consciousness.\u201d Nature Neuroscience 27 (3): 45\u201367. https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, Stephen Draper, Clayton Lewis, et al. 2013. The Design of Everyday Things. 2nd ed. Vol. 3. Basic Books.',
      chapter: 'LeCun, Yann. 2016. \u201cDeep Learning Fundamentals.\u201d In Deep Learning, 1st ed., edited by Ian Goodfellow and Yoshua Bengio. MIT Press.',
      webpage: 'Writer, Wendy. n.d. \u201cHow to Cite a Web Page.\u201d Example Site. Accessed February 1, 2024. https://example.org/cite.',
      cite: '(Smith et al. 2024; Norman et al. 2013)',
    },
    'fr-FR': {
      article: 'Smith, John Andrew, Barbara Carol Jones, et Charles Brown. 2024. «\u00a0Neural Correlates of Consciousness\u00a0». Nature Neuroscience 27 (3): 45\u201167. https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, Stephen Draper, Clayton Lewis, et al. 2013. The Design of Everyday Things. 2ᵉ éd. Vol. 3. Basic Books.',
      chapter: 'LeCun, Yann. 2016. «\u00a0Deep Learning Fundamentals\u00a0». In Deep Learning, 1ʳᵉ éd., édité par Ian Goodfellow et Yoshua Bengio. MIT Press.',
      webpage: 'Writer, Wendy. s.\u00a0d. «\u00a0How to Cite a Web Page\u00a0». Example Site. Consulté le 1 février 2024. https://example.org/cite.',
      cite: '(Smith et al. 2024; Norman et al. 2013)',
    },
    'de-DE': {
      article: 'Smith, John Andrew, Barbara Carol Jones, und Charles Brown. 2024. \u201eNeural Correlates of Consciousness\u201c. Nature Neuroscience 27 (3): 45\u201367. https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, Stephen Draper, Clayton Lewis, u.\u00a0a. 2013. The Design of Everyday Things. 2. Aufl. Bd. 3. Basic Books.',
      chapter: 'LeCun, Yann. 2016. \u201eDeep Learning Fundamentals\u201c. In Deep Learning, 1. Aufl., herausgegeben von Ian Goodfellow und Yoshua Bengio. MIT Press.',
      webpage: 'Writer, Wendy. o.\u00a0J. \u201eHow to Cite a Web Page\u201c. Example Site. Zugegriffen 1. Februar 2024. https://example.org/cite.',
      cite: '(Smith u.\u00a0a. 2024; Norman u.\u00a0a. 2013)',
    },
    'es-ES': {
      article: 'Smith, John Andrew, Barbara Carol Jones, y Charles Brown. 2024. «Neural Correlates of Consciousness». Nature Neuroscience 27 (3): 45-67. https://doi.org/10.1038/nn.2024.',
      book: 'Norman, Donald, Stephen Draper, Clayton Lewis, et\u00a0al. 2013. The Design of Everyday Things. 2.ª ed. Vol. 3. Basic Books.',
      chapter: 'LeCun, Yann. 2016. «Deep Learning Fundamentals». En Deep Learning, 1.ª ed., editado por Ian Goodfellow y Yoshua Bengio. MIT Press.',
      webpage: 'Writer, Wendy. s.\u00a0f. «How to Cite a Web Page». Example Site. Accedido 1 de febrero de 2024. https://example.org/cite.',
      cite: '(Smith et\u00a0al. 2024; Norman et\u00a0al. 2013)',
    },
  },
}

afterEach(() => vi.restoreAllMocks())

for (const [name, byLocale] of Object.entries(EXPECTED)) {
  describe(`${name} in a locale pack`, () => {
    let style
    beforeAll(async () => {
      style = await compileAndEval(readFileSync(join(fixturesDir, `${name}.csl`), 'utf-8'))
    })

    for (const [lang, expected] of Object.entries(byLocale)) {
      it(lang === 'none' ? 'formats in its default locale with no locale' : `formats in ${lang}`, () => {
        const ctx = lang === 'none' ? undefined : { locale: packs.get(lang) }
        for (const item of Object.keys(items)) {
          expect(style.bibliography(items[item], ctx).text).toBe(expected[item])
        }
        expect(style.citation([{ item: items.article }, { item: items.book }], ctx).text).toBe(expected.cite)
      })
    }

    it('formats HTML in the locale too', () => {
      const html = style.bibliography(items.book, { locale: packs.get('de-DE') }).html
      expect(html).toContain('<span class="csl-edition">2.</span> Aufl.')
    })

    it('formats in its default locale for a locale of null or undefined', () => {
      for (const item of Object.values(items)) {
        const before = style.bibliography(item)
        expect(style.bibliography(item, { locale: undefined })).toEqual(before)
        expect(style.bibliography(item, { locale: null })).toEqual(before)
      }
    })
  })
}

// ── Precedence ───────────────────────────────────────────────────────────────

const precedenceStyle = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Locale precedence</title><id>precedence</id></info>
  <locale>
    <terms>
      <term name="and">generic and</term>
      <term name="in">generic in</term>
      <term name="et-al">generic et-al</term>
    </terms>
  </locale>
  <locale xml:lang="fr">
    <terms>
      <term name="and">fr and</term>
      <term name="in">fr in</term>
    </terms>
  </locale>
  <locale xml:lang="fr-CA">
    <terms>
      <term name="and">fr-CA and</term>
    </terms>
  </locale>
  <bibliography>
    <layout>
      <group delimiter=" | ">
        <text term="and"/>
        <text term="in"/>
        <text term="et-al"/>
        <text term="retrieved"/>
        <text term="graphic"/>
      </group>
    </layout>
  </bibliography>
</style>`

describe('locale precedence', () => {
  let style
  beforeAll(async () => {
    style = await compileAndEval(precedenceStyle)
  })

  it('applies the style\'s own <locale> elements over the pack: none, then language, then dialect', () => {
    // "and": fr-FR's "et" < generic < fr. "retrieved": the pack's, which no <locale> overrides
    expect(style.bibliography({ type: 'book' }, { locale: packs.get('fr-FR') }).text)
      .toBe('fr and | fr in | generic et-al | consulté | image')
    expect(style.bibliography({ type: 'book' }, { locale: packs.get('fr-CA') }).text)
      .toBe('fr-CA and | fr in | generic et-al | consulté | image')
  })

  it('applies none of the French elements to another language', () => {
    expect(style.bibliography({ type: 'book' }, { locale: packs.get('de-DE') }).text)
      .toBe('generic and | generic in | generic et-al | abgerufen | Bild')
  })

  it('falls back from a dialect pack to its primary dialect for a term only the primary defines', () => {
    // locales-de-CH.xml defines no "graphic": de-DE's "Bild", not en-US's "graphic"
    expect(style.bibliography({ type: 'book' }, { locale: packs.get('de-CH') }).text)
      .toBe('generic and | generic in | generic et-al | abgerufen | Bild')
  })

  it('keeps the default resolution with no locale', () => {
    expect(style.bibliography({ type: 'book' }).text).toBe('generic and | generic in | generic et-al | retrieved | graphic')
  })

  it('applies APA\'s own <locale xml:lang="es"> and <locale xml:lang="de"> over the packs', async () => {
    const apa = await compileAndEval(readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8'))
    // es-ES says "a partir de", APA's own Spanish "de"; de-DE says "u. a.", APA's own German "et al."
    expect(apa.bibliography(items.webpage, { locale: packs.get('es-ES') }).text).toContain(', de https://example.org/cite')
    expect(apa.citation([{ item: items.book }], { locale: packs.get('de-DE') }).text).toBe('(Norman et al., 2013)')
  })

  it('switches a style with another default to English with the en-US pack', async () => {
    const dgps = await compileAndEval(readFileSync(join(fixturesDir, 'deutsche-gesellschaft-fur-psychologie.csl'), 'utf-8'))
    expect(dgps.bibliography(items.book).text).toContain('Auflage')
    const english = dgps.bibliography(items.book, { locale: packs.get('en-US') }).text
    expect(english).toContain('(2nd edition, Volume 3)')
    expect(english).not.toContain('Auflage')
  })
})

describe('locale packs and the style\'s code', () => {
  it('formats in the default locale, with a warning, for a pack format version it doesn\'t know', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mla = await compileAndEval(readFileSync(join(fixturesDir, 'mla.csl'), 'utf-8'))
    const future = { ...packs.get('fr-FR'), version: 2 }
    expect(mla.bibliography(items.article, { locale: future }).text).toBe(mla.bibliography(items.article).text)
    expect(mla.citation([{ item: items.article }], { locale: future }).text).toBe(mla.citation([{ item: items.article }]).text)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('fr-FR has format version 2')
  })

  it('takes a pack served as JSON', async () => {
    const mla = await compileAndEval(readFileSync(join(fixturesDir, 'mla.csl'), 'utf-8'))
    const served = JSON.parse(JSON.stringify(packs.get('de-DE')))
    expect(mla.bibliography(items.book, { locale: served }).text).toBe(EXPECTED.mla['de-DE'].book)
  })

  it('renders the sort keys in the locale passed to bibliographySort', async () => {
    const style = await compileAndEval(`<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Sort by date</title><id>sort</id></info>
  <macro name="key">
    <choose>
      <if variable="issued"><text value="m"/></if>
      <else><text term="no date" form="short"/></else>
    </choose>
  </macro>
  <bibliography>
    <sort><key macro="key"/></sort>
    <layout><text variable="title"/></layout>
  </bibliography>
</style>`)
    const dated = { id: 'a', type: 'book', title: 'Dated', issued: { 'date-parts': [[2020]] } }
    const undated = { id: 'b', type: 'book', title: 'Undated' }
    expect([undated, dated].sort(style.bibliographySort).map((i) => i.id)).toEqual(['a', 'b']) // "m" < "n.d."
    const pack = { version: 1, lang: 'xx', terms: { 'no date:short': 'a.d.' } }
    expect([dated, undated].sort((a, b) => style.bibliographySort(a, b, { locale: pack })).map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('carries only the en-US terms a style reaches, and the families it reaches by computed names', () => {
    const { code } = compile(readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8'))
    const en = JSON.parse(code.match(/^const EN = (.*)$/m)[1])
    const keys = Object.keys(en.terms)
    expect(keys.length).toBeLessThan(200)
    expect(keys).toContain('retrieved') // <text term="retrieved">
    expect(keys).toContain('ordinal-02') // <number form="ordinal">
    expect(keys).toContain('figure:short') // <label variable="locator" form="short">
    expect(keys).toContain('open-quote')
    expect(keys).not.toContain('podcast-episode')
  })
})
