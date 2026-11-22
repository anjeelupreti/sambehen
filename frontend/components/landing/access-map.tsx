'use client';

import { useState } from 'react';

import { ACCESS_NODES, type AccessNode } from './landing-data';
import { cn } from '@/lib/utils';

/**
 * The master → manager → store chain, as the staff tree in the product
 * draws it. Choosing a role highlights the part of the chain it can reach
 * and dims everything it cannot — what that person would see signed in.
 */
export function AccessMap() {
  const [selectedId, setSelectedId] = useState('m1');
  const selected = ACCESS_NODES.find((node) => node.id === selectedId)!;

  const visible = new Set(reachable(selected.id));
  const master = ACCESS_NODES.find((node) => node.role === 'master')!;
  const managers = ACCESS_NODES.filter((node) => node.role === 'manager');

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-12">
      <div className="border-lp-line bg-lp-raised min-w-0 overflow-x-auto rounded-2xl border p-5 sm:p-8">
        <div className="min-w-[36rem]">
          <div className="flex justify-center">
            <NodeButton
              node={master}
              selected={selectedId === master.id}
              reachable={visible.has(master.id)}
              onSelect={setSelectedId}
            />
          </div>

          {/* Connector from master to the manager row */}
          <div aria-hidden className="mx-auto h-6 w-px bg-lp-line-strong" />
          <div
            aria-hidden
            className="border-lp-line-strong relative mx-[16.66%] h-6 border-x border-t"
          >
            <span className="bg-lp-line-strong absolute top-0 left-1/2 h-full w-px" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {managers.map((manager) => {
              const stores = ACCESS_NODES.filter((node) => node.parent === manager.id);
              return (
                <div key={manager.id} className="flex flex-col items-center">
                  <NodeButton
                    node={manager}
                    selected={selectedId === manager.id}
                    reachable={visible.has(manager.id)}
                    onSelect={setSelectedId}
                  />
                  <div aria-hidden className="h-5 w-px bg-lp-line-strong" />
                  <ul className="border-lp-line-strong flex w-full flex-col gap-2 border-l pl-3">
                    {stores.map((store) => (
                      <li key={store.id}>
                        <NodeButton
                          node={store}
                          selected={selectedId === store.id}
                          reachable={visible.has(store.id)}
                          onSelect={setSelectedId}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:pt-4" aria-live="polite">
        <p className="text-lp-dim text-sm">Signed in as</p>
        <p className="mt-1 text-2xl font-semibold [font-stretch:115%]">{selected.label}</p>
        <p className="mt-4 leading-relaxed">{selected.sees}</p>
        <p className="mt-6 text-sm">
          <span className="tabular text-lp-chip-text text-3xl font-semibold [font-stretch:112%]">
            {selected.players}
          </span>{' '}
          <span className="text-lp-dim">of 36 players visible</span>
        </p>
        {selected.role !== 'master' && (
          <p className="text-lp-dim mt-6 text-sm leading-relaxed">
            Opening anything outside this chain returns Not found, so nobody can confirm a record
            exists.
          </p>
        )}
      </div>
    </div>
  );
}

function reachable(id: string): string[] {
  const children = ACCESS_NODES.filter((node) => node.parent === id);
  return [id, ...children.flatMap((child) => reachable(child.id))];
}

function NodeButton({
  node,
  selected,
  reachable: isReachable,
  onSelect,
  compact,
}: {
  node: AccessNode;
  selected: boolean;
  reachable: boolean;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      className={cn(
        'focus-visible:outline-lp-primary flex w-full items-center justify-between gap-3 rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
        compact ? 'px-3 py-2 text-xs' : 'max-w-[12rem] px-4 py-3 text-sm',
        selected
          ? 'border-lp-primary bg-lp-primary/8'
          : isReachable
            ? 'border-lp-line-strong bg-lp-sunk hover:border-lp-dim'
            : 'border-lp-line text-lp-dim hover:text-lp-text bg-transparent',
      )}
    >
      <span className="font-medium">{node.label}</span>
      <span className="tabular text-lp-dim">{node.players}</span>
    </button>
  );
}
