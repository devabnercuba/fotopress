/**
 * Controle central de funcionalidades (Feature Flags) do FotoPress.
 *
 * Permite desativar módulos temporariamente de forma segura,
 * garantindo que consultas ao banco, rotas, ações na interface e
 * chamadas automáticas sejam desabilitadas sem perda de dados ou código.
 */

export const FEATURES = {
  /**
   * Módulo Radar da Partida.
   * O Radar não será utilizado nesta fase e está desativado por padrão.
   * Pode ser retomado futuramente alterando esta flag para true.
   */
  RADAR_ENABLED: false,
} as const;

/**
 * Retorna se a funcionalidade de Radar está ativa no sistema.
 */
export function isRadarEnabled(): boolean {
  return FEATURES.RADAR_ENABLED;
}
