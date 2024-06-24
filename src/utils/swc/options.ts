// The MIT License (MIT)

// Copyright (c) 2024 Vercel, Inc.
// https://github.com/vercel/next.js/blob/canary/packages/next/src/build/swc/options.ts

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import type { NextConfig } from "next";
import type { JsConfig, ResolvedBaseUrl } from "next/dist/build/load-jsconfig";
import { getParserOptions } from "next/dist/build/swc/options";
import type { ExperimentalConfig } from "next/dist/server/config-shared";
import { shouldOutputCommonJs } from "../nextjs";
import { getEmotionOptions, getStyledComponentsOptions } from "./styles";

const regeneratorRuntimePath = require.resolve(
	"next/dist/compiled/regenerator-runtime",
);

function getBaseSWCOptions({
	filename,
	development,
	hasReactRefresh,
	globalWindow,
	esm,
	modularizeImports,
	swcPlugins,
	compilerOptions,
	resolvedBaseUrl,
	jsConfig,
	swcCacheDir,
	sourceMaps,
}: {
	filename: string;
	jest?: boolean;
	development: boolean;
	hasReactRefresh: boolean;
	globalWindow: boolean;
	esm: boolean;
	modularizeImports?: NextConfig["modularizeImports"];
	compilerOptions: NextConfig["compiler"];
	swcPlugins: ExperimentalConfig["swcPlugins"];
	resolvedBaseUrl?: ResolvedBaseUrl;
	jsConfig: JsConfig;
	swcCacheDir?: string;
	sourceMaps: boolean | "inline";
}) {
	const parserConfig = getParserOptions({ filename, jsConfig });
	const paths = jsConfig?.compilerOptions?.paths;
	const enableDecorators = Boolean(
		jsConfig?.compilerOptions?.experimentalDecorators,
	);
	const emitDecoratorMetadata = Boolean(
		jsConfig?.compilerOptions?.emitDecoratorMetadata,
	);
	const useDefineForClassFields = Boolean(
		jsConfig?.compilerOptions?.useDefineForClassFields,
	);
	const plugins = (swcPlugins ?? [])
		.filter(Array.isArray)
		.map(([name, options]) => [require.resolve(name), options]);

	return {
		jsc: {
			...(resolvedBaseUrl && paths
				? {
						baseUrl: resolvedBaseUrl.baseUrl,
						paths,
					}
				: {}),
			externalHelpers: false,
			parser: parserConfig,
			experimental: {
				keepImportAttributes: true,
				emitAssertForImportAttributes: true,
				plugins,
				cacheRoot: swcCacheDir,
			},
			transform: {
				legacyDecorator: enableDecorators,
				decoratorMetadata: emitDecoratorMetadata,
				useDefineForClassFields: useDefineForClassFields,
				react: {
					importSource:
						jsConfig?.compilerOptions?.jsxImportSource ??
						(compilerOptions?.emotion ? "@emotion/react" : "react"),
					runtime: "automatic",
					pragmaFrag: "React.Fragment",
					throwIfNamespace: true,
					development: !!development,
					useBuiltins: true,
					refresh: !!hasReactRefresh,
				},
				optimizer: {
					simplify: false,
					// TODO: Figuring out for what globals are exactly used for
					globals: {
						typeofs: {
							window: globalWindow ? "object" : "undefined",
						},
						envs: {
							NODE_ENV: development ? '"development"' : '"production"',
						},
					},
				},
				regenerator: {
					importPath: regeneratorRuntimePath,
				},
			},
		},
		sourceMaps,
		inlineSourcesContent: sourceMaps,
		sourceFileName: filename,
		removeConsole: compilerOptions?.removeConsole,
		reactRemoveProperties: false,
		// Map the k-v map to an array of pairs.
		modularizeImports: modularizeImports
			? Object.fromEntries(
					Object.entries(modularizeImports).map(([mod, config]) => [
						mod,
						{
							...config,
							transform:
								typeof config.transform === "string"
									? config.transform
									: Object.entries(config.transform).map(([key, value]) => [
											key,
											value,
										]),
						},
					]),
				)
			: undefined,
		relay: compilerOptions?.relay,
		// Always transform styled-jsx and error when `client-only` condition is triggered
		styledJsx: {},
		// Disable css-in-js libs (without client-only integration) transform on server layer for server components
		emotion: getEmotionOptions(compilerOptions?.emotion, development),
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		styledComponents: getStyledComponentsOptions(
			compilerOptions?.styledComponents,
			development,
		),
		serverComponents: undefined,
		serverActions: undefined,
		// For app router we prefer to bundle ESM,
		// On server side of pages router we prefer CJS.
		preferEsm: esm,
	};
}

type VitestSWCOptionsParams = {
	isServer: boolean;
	filename: string;
	esm: boolean;
	modularizeImports?: NextConfig["modularizeImports"];
	swcPlugins: ExperimentalConfig["swcPlugins"];
	compilerOptions: NextConfig["compiler"];
	jsConfig: JsConfig;
	resolvedBaseUrl?: ResolvedBaseUrl;
	pagesDir?: string;
	serverComponents?: boolean;
	sourceMaps: boolean | "inline";
};

/**
 * Get the SWC options for being passed to Next.js' custom SWC transpiler
 */
export function getVitestSWCOptions({
	isServer,
	filename,
	esm,
	modularizeImports,
	swcPlugins,
	compilerOptions,
	jsConfig,
	resolvedBaseUrl,
	pagesDir,
	sourceMaps,
}: VitestSWCOptionsParams) {
	const baseOptions = getBaseSWCOptions({
		filename,
		jest: true,
		development: false,
		hasReactRefresh: true,
		globalWindow: !isServer,
		modularizeImports,
		swcPlugins,
		compilerOptions,
		jsConfig,
		resolvedBaseUrl,
		esm,
		sourceMaps,
	});

	const useCjsModules = shouldOutputCommonJs(filename);
	return {
		...baseOptions,
		env: {
			targets: {
				// Targets the current version of Node.js
				node: process.versions.node,
			},
		},
		module: {
			type: esm && !useCjsModules ? "es6" : "commonjs",
		},
		disableNextSsg: true,
		disablePageConfig: true,
		pagesDir,
	};
}
