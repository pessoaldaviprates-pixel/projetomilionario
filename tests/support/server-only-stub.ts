/**
 * Stub de `server-only` para os testes.
 *
 * O pacote real lança erro fora do ambiente de servidor do Next. Nos testes
 * o código roda em Node puro, então o guarda não se aplica — mas queremos
 * manter o `import 'server-only'` no código de produção, que é onde ele
 * protege contra vazamento de segredo para o cliente.
 */
export {};
