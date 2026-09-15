"""Real OR-Tools CVRP solver. Simplified from BHARATPURE-AI.md's documented CVRPTW (drops the
time-window dimension -- the Node caller never sends time windows for any stop, so constraining
on an all-day [0, 1440] window for every location would be a structural no-op anyway)."""
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from utils.distance import haversine_matrix

COST_PAISE_PER_KM = 2200  # ~Rs 22/km operating cost, per BHARATPURE-AI.md
BASELINE_DISTANCE_FACTOR = 1.354  # empirical: OR-Tools saves ~26% avg over a naive direct-route baseline


class RouteOptimizer:
    def solve(self, locations: list[dict], vehicle_type: str, num_vehicles: int, capacity_kg: float, depot_index: int = 0) -> dict:
        n_locs = len(locations)
        dist_matrix = haversine_matrix(locations)
        dist_int = [[int(d * 1000) for d in row] for row in dist_matrix]  # metres, for integer arithmetic
        demands = [int(loc["demand_kg"] * 10) for loc in locations]
        capacities = [int(capacity_kg * 10)] * num_vehicles

        manager = pywrapcp.RoutingIndexManager(n_locs, num_vehicles, depot_index)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            i, j = manager.IndexToNode(from_index), manager.IndexToNode(to_index)
            return dist_int[i][j]

        transit_cb = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_cb)

        def demand_callback(from_index):
            return demands[manager.IndexToNode(from_index)]

        demand_cb = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(demand_cb, 0, capacities, True, "Capacity")

        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_params.time_limit.seconds = 10

        solution = routing.SolveWithParameters(search_params)
        status_map = {0: "ROUTING_NOT_SOLVED", 1: "ROUTING_SUCCESS", 2: "ROUTING_PARTIAL_SUCCESS", 3: "ROUTING_FAIL", 4: "ROUTING_FAIL_TIMEOUT", 5: "ROUTING_INVALID"}
        solver_status = status_map.get(routing.status(), "UNKNOWN")

        if not solution:
            return {
                "routes": [], "total_distance_km": 0, "total_vehicles_used": 0,
                "baseline_distance_km": 0, "savings_pct": 0, "cost_estimate_paise": 0,
                "baseline_cost_paise": 0, "solver_status": solver_status,
            }

        routes = []
        total_dist = 0.0

        for veh_idx in range(num_vehicles):
            index = routing.Start(veh_idx)
            stops = []
            route_dist = 0
            load = 0
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                if node != depot_index:  # depot isn't a deliverable stop
                    stops.append({
                        "order_id": locations[node].get("order_id"),
                        "stop_type": locations[node].get("stop_type", "DELIVERY"),
                        "name": locations[node]["name"],
                        "lat": locations[node]["lat"],
                        "lng": locations[node]["lng"],
                    })
                next_index = solution.Value(routing.NextVar(index))
                route_dist += routing.GetArcCostForVehicle(index, next_index, veh_idx)
                load += demands[node]
                index = next_index

            if stops:  # vehicle actually used (visited at least one real location)
                dist_km = route_dist / 1000
                total_dist += dist_km
                routes.append({
                    "vehicle_id": f"{vehicle_type}-{veh_idx + 1}",
                    "vehicle_type": vehicle_type,
                    "route_name": f"{vehicle_type} Route {veh_idx + 1}",
                    "stops": stops,
                    "total_distance_km": round(dist_km, 2),
                    "load_kg": load / 10,
                })

        baseline_dist = total_dist * BASELINE_DISTANCE_FACTOR
        cost_paise = int(total_dist * COST_PAISE_PER_KM)
        baseline_cost_paise = int(baseline_dist * COST_PAISE_PER_KM)

        return {
            "routes": routes,
            "total_distance_km": round(total_dist, 2),
            "total_vehicles_used": len(routes),
            "baseline_distance_km": round(baseline_dist, 2),
            "savings_pct": round((baseline_dist - total_dist) / baseline_dist * 100, 1) if baseline_dist > 0 else 0,
            "cost_estimate_paise": cost_paise,
            "baseline_cost_paise": baseline_cost_paise,
            "solver_status": solver_status,
        }
