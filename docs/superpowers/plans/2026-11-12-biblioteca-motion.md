# Movimento na Biblioteca e no catálogo

Escopo aprovado: entradas discretas de cartões e feedback nas abas, preservando paleta e funções.
Adaptar o conceito do Animated Content de React Bits com APIs nativas, sem GSAP: IntersectionObserver e Web Animations. Conteúdo visível por padrão, entrada uma vez, 280ms, atraso máximo 120ms, sem blur. Movimento reduzido desativa efeitos; limpar observadores e animações ao desmontar.

1. Hook compartilhado nas listas locais e catálogo, mantendo ul/li e paginação.
2. Feedback de foco e hover apenas em dispositivos com mouse; animar opacity/transform.
3. Verificar TypeScript, build e diff. Usuário valida no navegador; sem commits.
