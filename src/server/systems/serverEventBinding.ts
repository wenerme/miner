import type { EventBus } from '#/common/EventBus';
import type { ProtocolC2S } from '#/common/GameContext';

export interface ServerC2SHandlers {
  requestChunks: (input: ProtocolC2S['c2s:requestChunks']) => void;
  attackEntity: (input: ProtocolC2S['c2s:attackEntity']) => void;
  breakBlock: (input: ProtocolC2S['c2s:breakBlock']) => void;
  startBreak: (input: ProtocolC2S['c2s:startBreak']) => void;
  cancelBreak: (input: ProtocolC2S['c2s:cancelBreak']) => void;
  interactBlock: (input: ProtocolC2S['c2s:interactBlock']) => void;
  placeBlock: (input: ProtocolC2S['c2s:placeBlock']) => void;
  interactEntity: (input: ProtocolC2S['c2s:interactEntity']) => void;
  craft: (input: ProtocolC2S['c2s:craft']) => void;
  chat: (input: ProtocolC2S['c2s:chat']) => void;
  command: (input: ProtocolC2S['c2s:command']) => void;
  swapOffhand: (input: ProtocolC2S['c2s:swapOffhand']) => void;
  inventoryClick: (input: ProtocolC2S['c2s:inventoryClick']) => void;
  inventoryCollect: (input: ProtocolC2S['c2s:inventoryCollect']) => void;
  inventoryClose: (input: ProtocolC2S['c2s:inventoryClose']) => void;
  furnaceClick: (input: ProtocolC2S['c2s:furnaceClick']) => void;
  furnaceClose: (input: ProtocolC2S['c2s:furnaceClose']) => void;
  chestClick: (input: ProtocolC2S['c2s:chestClick']) => void;
  chestClose: (input: ProtocolC2S['c2s:chestClose']) => void;
  useItem: (input: ProtocolC2S['c2s:useItem']) => void;
}

export function bindServerC2SEvents(
  c2s: EventBus<ProtocolC2S>,
  handlers: ServerC2SHandlers,
): Array<() => void> {
  return [
    c2s.on('c2s:requestChunks', handlers.requestChunks),
    c2s.on('c2s:attackEntity', handlers.attackEntity),
    c2s.on('c2s:breakBlock', handlers.breakBlock),
    c2s.on('c2s:startBreak', handlers.startBreak),
    c2s.on('c2s:cancelBreak', handlers.cancelBreak),
    c2s.on('c2s:interactBlock', handlers.interactBlock),
    c2s.on('c2s:placeBlock', handlers.placeBlock),
    c2s.on('c2s:interactEntity', handlers.interactEntity),
    c2s.on('c2s:craft', handlers.craft),
    c2s.on('c2s:chat', handlers.chat),
    c2s.on('c2s:command', handlers.command),
    c2s.on('c2s:swapOffhand', handlers.swapOffhand),
    c2s.on('c2s:inventoryClick', handlers.inventoryClick),
    c2s.on('c2s:inventoryCollect', handlers.inventoryCollect),
    c2s.on('c2s:inventoryClose', handlers.inventoryClose),
    c2s.on('c2s:furnaceClick', handlers.furnaceClick),
    c2s.on('c2s:furnaceClose', handlers.furnaceClose),
    c2s.on('c2s:chestClick', handlers.chestClick),
    c2s.on('c2s:chestClose', handlers.chestClose),
    c2s.on('c2s:useItem', handlers.useItem),
  ];
}
