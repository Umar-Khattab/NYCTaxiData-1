import { create } from 'zustand'
import { fleetApi, type ApiSimulationInput, type ApiSimulationResult } from '@/lib/fleet-api'
import { signalrService } from '@/services/signalrService'

// Re-export shapes the rest of the app already imports from here
export interface SimulationInput {
  target_datetime: string
  action_type: 'reposition' | 'expansion' | 'none'
  constraints: {
    max_vehicles: number
    budget_limit: number
    service_level: number
  }
}

export interface SimulationResult {
  baseline: {
    profit: number
    demand_met: number
    fleet_utilization: number
    revenue: number
    cost: number
  }
  action: {
    profit: number
    demand_met: number
    fleet_utilization: number
    revenue: number
    cost: number
  }
  p50_impact: number
  p90_impact: number
  recommendation: string
  flowArcs: Array<{
    from: [number, number]
    to: [number, number]
    type: 'baseline' | 'action'
    volume: number
  }>
}

interface SimulationEngineState {
  input: SimulationInput
  result: SimulationResult | null
  isLoading: boolean
  progress: number
  statusMessage: string | null
  error: string | null
  isSignalRInitialized: boolean
  setInput: (input: Partial<SimulationInput>) => void
  runSimulation: (input: SimulationInput) => Promise<void>
  clearResult: () => void
  setError: (error: string | null) => void
  initSignalR: () => Promise<void>
}

const defaultInput: SimulationInput = {
  target_datetime: new Date().toISOString().slice(0, 16),
  action_type: 'reposition',
  constraints: {
    max_vehicles: 50,
    budget_limit: 10000,
    service_level: 95,
  },
}

export const useSimulationEngineStore = create<SimulationEngineState>((set, get) => ({
  input: defaultInput,
  result: null,
  isLoading: false,
  progress: 0,
  statusMessage: null,
  error: null,
  isSignalRInitialized: false,

  initSignalR: async () => {
    if (get().isSignalRInitialized) return;
    
    await signalrService.startConnection();
    
    signalrService.onSimulationProgress((progress, message) => {
      set({ progress, statusMessage: message });
    });

    signalrService.onSimulationCompleted((result: SimulationResult) => {
      set({ result, isLoading: false, progress: 100, statusMessage: 'Simulation Complete' });
    });

    set({ isSignalRInitialized: true });
  },

  setInput: (updates) =>
    set((state) => ({
      input: {
        ...state.input,
        ...updates,
        constraints: {
          ...state.input.constraints,
          ...(updates.constraints ?? {}),
        },
      },
    })),

  runSimulation: async (input) => {
    // Ensure SignalR is listening before we start
    await get().initSignalR();
    
    set({ isLoading: true, error: null, progress: 0, statusMessage: 'Starting simulation...' })
    try {
      // The API call might still return a result, but we also listen via SignalR.
      // If the backend is updated to return 202 Accepted and broadcast via SignalR,
      // this HTTP request will resolve quickly.
      const result = await fleetApi.simulation.run(input)
      
      // If the API returns the result synchronously (legacy behavior), update state.
      // If it relies entirely on SignalR now, the backend might return `{}` or empty.
      if (result && Object.keys(result).length > 0 && result.baseline) {
         set({ result, isLoading: false, progress: 100, statusMessage: 'Completed' })
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Simulation failed',
        isLoading: false,
        statusMessage: null
      })
    }
  },

  clearResult: () => set({ result: null, progress: 0, statusMessage: null }),
  setError: (error) => set({ error }),
}))
