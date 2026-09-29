CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_profile_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"description" text,
	"source_onboarding_submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_businesses_merchant_profile_id" UNIQUE("merchant_profile_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_business_setup_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_profile_id" uuid NOT NULL,
	"source_onboarding_submission_id" uuid,
	"business_setup_payload" jsonb,
	"outlet_setup_payload" jsonb,
	"operating_hours_payload" jsonb,
	"current_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outlet_operating_hours" (
	"id" uuid PRIMARY KEY NOT NULL,
	"outlet_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"open_time" time,
	"close_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_outlet_operating_hours_outlet_day" UNIQUE("outlet_id","day_of_week"),
	CONSTRAINT "chk_operating_hours_validity" CHECK (
		("is_closed" = true AND "open_time" IS NULL AND "close_time" IS NULL) OR
		("is_closed" = false AND "open_time" IS NOT NULL AND "close_time" IS NOT NULL AND "open_time" < "close_time")
	)
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"province" varchar(128) NOT NULL,
	"regency_or_city" varchar(128) NOT NULL,
	"district" varchar(128) NOT NULL,
	"village_or_subdistrict" varchar(128) NOT NULL,
	"address_detail" text NOT NULL,
	"postal_code" varchar(16),
	"location" geography(Point, 4326) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_merchant_profile_id_merchant_profiles_id_fk" FOREIGN KEY ("merchant_profile_id") REFERENCES "public"."merchant_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_source_onboarding_submission_id_merchant_onboarding_submissions_id_fk" FOREIGN KEY ("source_onboarding_submission_id") REFERENCES "public"."merchant_onboarding_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_business_setup_drafts" ADD CONSTRAINT "merchant_business_setup_drafts_merchant_profile_id_merchant_profiles_id_fk" FOREIGN KEY ("merchant_profile_id") REFERENCES "public"."merchant_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_business_setup_drafts" ADD CONSTRAINT "merchant_business_setup_drafts_source_onboarding_submission_id_merchant_onboarding_submissions_id_fk" FOREIGN KEY ("source_onboarding_submission_id") REFERENCES "public"."merchant_onboarding_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_operating_hours" ADD CONSTRAINT "outlet_operating_hours_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_businesses_merchant_profile_id" ON "businesses" USING btree ("merchant_profile_id");--> statement-breakpoint
CREATE INDEX "idx_businesses_source_submission" ON "businesses" USING btree ("source_onboarding_submission_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_business_setup_drafts_profile" ON "merchant_business_setup_drafts" USING btree ("merchant_profile_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_business_setup_drafts_submission" ON "merchant_business_setup_drafts" USING btree ("source_onboarding_submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_merchant_business_setup_drafts_active" ON "merchant_business_setup_drafts" USING btree ("merchant_profile_id") WHERE "merchant_business_setup_drafts"."completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_outlet_operating_hours_outlet_id" ON "outlet_operating_hours" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "idx_outlets_business_id" ON "outlets" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outlets_business_primary" ON "outlets" USING btree ("business_id") WHERE "outlets"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "idx_outlets_location" ON "outlets" USING gist ("location");