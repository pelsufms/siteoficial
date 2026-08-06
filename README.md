# IEEE PELS UFMS Chapter — Website

Site institucional do Capítulo Estudantil IEEE PELS UFMS, feito para o **IEEE Regional Awards &
Contests 2026 — Student Website Contest** (edital R9 SAC).

Stack: HTML + CSS + JavaScript puros (sem framework/build step), pensado para ser aberto e editado
direto no VSCode.

## Estrutura

```
pels-ufms-website/
├── index.html          # página única com todas as seções exigidas pelo edital
├── css/style.css        # design system (cor extraída da logo) + animações de scroll
├── js/main.js            # menu mobile, scrollspy, reveal on scroll, contadores, filtro da timeline
└── assets/img/           # logo e favicons gerados a partir do PDF da marca
```

## Rodar localmente

Não precisa de servidor nem instalação. Basta abrir `index.html` no navegador, ou no VSCode usar a
extensão **Live Server** (botão "Go Live") para ter live-reload enquanto edita.

## Publicar no GitHub Pages (recomendado pelo edital: URL pública)

```bash
cd pels-ufms-website
git init
git add .
git commit -m "Site IEEE PELS UFMS Chapter"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/pels-ufms-website.git
git push -u origin main
```

Depois, no GitHub: **Settings → Pages → Source: branch `main` / pasta `/root`** → salvar. O site fica
disponível em `https://<seu-usuario>.github.io/pels-ufms-website/` em alguns minutos. Esse é o link
que deve ir no formulário de submissão e no relatório do edital.

## Checklist do que ainda falta preencher (conteúdo real)

- [x] **Conselheiro(a)/Advisor** — confirmado como Raymundo Cordero, já preenchido na Diretoria.
- [ ] Fotos reais da diretoria (hoje os cards usam iniciais em vez de foto)
- [ ] **Fotos de confraternizações e do PELS Day** — a seção `#galeria` já está com 4 fotos reais
      recuperadas do Instagram público (@pels_ufms), mas o feed público é majoritariamente arte de
      divulgação (posters), não fotos de confraternização/PELS Day especificamente. Envie os arquivos
      originais (ou aponte os posts/destaques certos do Instagram) para eu trocar em
      `assets/img/gallery/` e ajustar as legendas em `index.html` (busque `TODO: substituir/completar`).
- [x] Datas específicas de alguns eventos já confirmadas via Instagram: Palestra BEM (02/04/2026),
      Webinar Mariana Espinola (26/05/2026), Power English (última edição 04/08/2026). Demais itens
      ainda usam rótulos genéricos ("Em andamento" / "Recorrente").
- [ ] Confirmar se o e-mail, WhatsApp e YouTube linkados ainda são os oficiais
- [ ] Relatório de documentação (até 4 páginas, template oficial do R9, em inglês) — não faz parte
      deste site, é um PDF separado exigido pelo edital

## Notas sobre o edital

- Critério de maior peso é **Conteúdo e Oportunidades (40/100)** — a seção `#oportunidades` foi
  priorizada para isso.
- O edital diz explicitamente que **técnica avançada de programação não é avaliada diretamente** —
  o foco da nota é relevância, acessibilidade e utilidade do conteúdo, não a complexidade do código.
- Animações respeitam `prefers-reduced-motion` e todo o site é responsivo (testado em mobile/desktop).

## Camada 3D / interativa

- **Galeria com lightbox** (`#galeria`): clique em qualquer foto para abrir em tela cheia, com
  navegação por setas, teclado (← → Esc) e legenda.
- **Tilt 3D**: os cards da galeria seguem o cursor do mouse com rotação em perspectiva
  (`js/main.js`, seção "3D tilt").
- **Spotlight**: cards de Oportunidades e Diretoria têm um brilho que segue o cursor.
- **Ripple**: todo botão (`.btn`, filtros, menu, voltar ao topo) tem feedback de clique em onda.
- **Hero com zoom em profundidade** (inspirado no efeito de scroll do site "The Goonies"/Webflow):
  ao rolar a página, a mascote do hero escala e desaparece como se a câmera passasse por ela,
  enquanto o texto se move mais devagar, criando separação de profundidade.
- **Cena fixa de estatísticas** (inspirada no visual cinematográfico do staratlas.com): a seção de
  números do capítulo "prende" a rolagem por alguns segundos com um fundo estrelado e os números
  aparecem em sequência com escala/blur, como uma cena de trailer.
- **Revelação de títulos em "cortina"**: os títulos de cada seção aparecem com um wipe (`clip-path`)
  ao entrar na tela, no estilo usado em sites Webflow premiados.
- Tudo isso é automaticamente desativado se o usuário tiver "reduzir movimento" ativado no sistema
  (testado e confirmado).
