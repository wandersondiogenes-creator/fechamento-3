CREATE TABLE "dealer_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" serial NOT NULL,
	"data" text,
	"entrada" numeric(12, 2),
	"saida" numeric(12, 2),
	"conta_classificacao" text,
	"historico" text,
	"raw_content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"total_rows" serial NOT NULL,
	"headers" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules_config" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
