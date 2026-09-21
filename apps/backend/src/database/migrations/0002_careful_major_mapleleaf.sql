CREATE TABLE "profile_verification_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"profile_type" varchar(32) NOT NULL,
	"profile_id" uuid NOT NULL,
	"actor_admin_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"from_status" varchar(32) NOT NULL,
	"to_status" varchar(32) NOT NULL,
	"reason" text,
	"request_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_verification_audit_logs" ADD CONSTRAINT "profile_verification_audit_logs_actor_admin_id_admin_accounts_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_profile_verification_audit_target" ON "profile_verification_audit_logs" USING btree ("profile_type","profile_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_profile_verification_audit_actor" ON "profile_verification_audit_logs" USING btree ("actor_admin_id");--> statement-breakpoint
CREATE INDEX "idx_driver_profiles_status_created" ON "driver_profiles" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_merchant_profiles_status_created" ON "merchant_profiles" USING btree ("status","created_at");