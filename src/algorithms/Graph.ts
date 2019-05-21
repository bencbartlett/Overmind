export class Vertex {
	id: number | undefined;
	value?: any;
	edges: Edge[];
	neighbors: Vertex[];
	data: { [property: string]: any };

	constructor(value?: any) {
		this.value = value;
		this.edges = [];
		this.neighbors = [];
		this.data = {};
	}

	adjacentTo(vertex: Vertex) {
		return this.neighbors.includes(vertex);
	}
}

export class Edge {
	vertices: [Vertex, Vertex];
	weight: number;
	directional?: boolean;

	constructor(vertex1: Vertex, vertex2: Vertex, weight?: number, directional?: boolean) {
		this.vertices = [vertex1, vertex2];
		this.weight = weight ? weight : 1;
		this.directional = directional ? directional : false;
	}
}

export class Graph {

	vertices: Vertex[];
	edges: Edge[];
	directed: boolean;
	simple: boolean;
	connected: boolean;

	private counter: number;

	constructor(initializer: {
		V?: Vertex[],
		E?: Edge[],
		directed?: boolean,
		simple?: boolean,
		connected?: boolean
	} = {}) {
		_.defaults(initializer, {
			V        : [],
			E        : [],
			directed : false,
			simple   : true,
			connected: false
		});
		this.vertices = initializer.V!;
		this.edges = initializer.E!;
		this.directed = initializer.directed!;
		this.simple = initializer.directed!;
		this.connected = initializer.connected!;
		this.counter = 0;
	}

	addVertex(vertex: Vertex) {
		this.vertices.push(vertex);
		vertex.id = this.counter;
		this.counter++;
	}

	removeVertex(vertex: Vertex) {
		// Remove vertex from all of its neighbors
		for (const neighbor of vertex.neighbors) {
			_.remove(neighbor.neighbors, vertex);
		}
		// Remove all edges that touch the vertex
		_.remove(this.edges, edge => _.includes(edge.vertices, vertex));
		// Remove the vertex from the list
		_.remove(this.vertices, vertex);
	}

	addEdge(edge: Edge) {
		const [vertex1, vertex2] = edge.vertices;
		if (this.simple) {
			if (vertex1.neighbors.includes(vertex2) || vertex2.neighbors.includes(vertex1)) {
				throw new Error(`${vertex1.id} and ${vertex2.id} are already neighbors; graph is not simple.`);
			}
		}
		vertex1.neighbors.push(vertex2);
		vertex1.edges.push(edge);
		if (!edge.directional) {
			vertex2.neighbors.push(vertex1);
			vertex2.edges.push(edge);
		}
		this.edges.push(edge);
	}

	removeEdge(edge: Edge) {
		// Remove neighbors connected by this edge
		const [vertex1, vertex2] = edge.vertices;
		_.remove(vertex1.neighbors, vertex2);
		if (!edge.directional) {
			_.remove(vertex2.neighbors, vertex1);
		}
		_.remove(vertex1.edges, edge);
		_.remove(vertex2.edges, edge);
		_.remove(this.edges, edge);
	}

	connect(vertex1: Vertex, vertex2: Vertex, weight?: number, directional?: boolean) {
		const edge = new Edge(vertex1, vertex2, weight, directional);
		this.addEdge(edge);
	}

	disconnect(vertex1: Vertex, vertex2: Vertex) {
		let edge = _.find(vertex1.edges, edge => _.includes(edge.vertices, vertex2));
		if (!edge) {
			edge = _.find(vertex2.edges, edge => _.includes(edge.vertices, vertex1));
		}
		if (!edge) {
			throw new Error(`Could not find edge connecting vertices ${vertex1.id} and ${vertex2.id}!`);
		} else {
			this.removeEdge(edge);
		}
	}
}

export class CompleteGraph extends Graph {
	constructor(V: Vertex[]) {
		super({V: V, simple: true, connected: true});
		for (const v1 of this.vertices) {
			for (const v2 of this.vertices) {
				if (v1 != v2 && !v1.adjacentTo(v2)) {
					this.connect(v1, v2);
				}
			}
		}
	}
}
