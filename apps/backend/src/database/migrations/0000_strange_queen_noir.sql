CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"scope" varchar(255) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_idempotency_scope_key" UNIQUE("scope","idempotency_key")
);
--> statement-breakpoint
CREATE INDEX "idx_outbox_events_published_available" ON "outbox_events" USING btree ("published_at","available_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_events_aggregate" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_records" USING btree ("expires_at");