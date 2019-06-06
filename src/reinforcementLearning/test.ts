// // import * as onnx from 'onnxjs';
// //
// // // uncomment the following line to enable ONNXRuntime node binding
// // // require('onnxjs-node');
// //
// // // const assert = require('assert');
// //
// // export async function onnxtest() {
// // 	// Create an ONNX inference session with WebAssembly backend.
// // 	const session = new onnx.InferenceSession({backendHint: 'wasm'});
// // 	// Load an ONNX model. This model is Resnet50 that takes a 1*3*224*224 image and classifies it.
// // 	await session.loadModel("./add.onnx");
// //
// // 	const x = new Float32Array(3 * 4 * 5).fill(1);
// // 	const y = new Float32Array(3 * 4 * 5).fill(2);
// // 	const tensorX = new onnx.Tensor(x, 'float32', [3, 4, 5]);
// // 	const tensorY = new onnx.Tensor(y, 'float32', [3, 4, 5]);
// //
// // 	// Run model with Tensor inputs and get the result by output name defined in model.
// // 	const outputMap = await session.run([tensorX, tensorY]);
// // 	const outputData = outputMap.get('sum')!;
// //
// // 	// Check if result is expected.
// // 	// assert.deepEqual(outputData.dims, [3, 4, 5]);
// // 	// assert(outputData.data.every((value) => value === 3));
// // 	console.log(`Got an Tensor of size ${outputData.data.length} with all elements being ${outputData.data[0]}`);
// // }
//
//
// import * as tf from '@tensorflow/tfjs';
//
// export function tftest() {
// 	// Define a model for linear regression.
// 	const model = tf.sequential();
// 	model.add(tf.layers.dense({units: 1, inputShape: [1]}));
//
// 	model.compile({loss: 'meanSquaredError', optimizer: 'sgd'});
//
// // Generate some synthetic data for training.
// 	const xs = tf.tensor2d([1, 2, 3, 4], [4, 1]);
// 	const ys = tf.tensor2d([1, 3, 5, 7], [4, 1]);
//
// // Train the model using the data.
// 	model.fit(xs, ys, {epochs: 10, verbose: 1}).then(() => {
// 		// Use the model to do inference on a data point the model hasn't seen before:
// 		const pred = model.predict(tf.tensor2d([5], [1, 1]));
// 		console.log(`Prediction: ${pred}`);
// 		// Open the browser devtools to see the output
// 	});
// }
