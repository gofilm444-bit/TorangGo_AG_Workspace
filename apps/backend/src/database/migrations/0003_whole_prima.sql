CREATE TABLE "merchant_onboarding_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"document_type" varchar(32) DEFAULT 'KTP_FRONT' NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"sanitized_original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_merchant_onboarding_docs_key" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "merchant_onboarding_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" varchar(255),
	"nik" varchar(32),
	"email" varchar(255),
	"alternate_contact" varchar(64),
	"proposed_business_name" varchar(255),
	"business_category" varchar(64),
	"business_description" text,
	"province" varchar(128),
	"regency_or_city" varchar(128),
	"district" varchar(128),
	"village_or_subdistrict" varchar(128),
	"address_detail" text,
	"ktp_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_merchant_onboarding_drafts_user_id" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_onboarding_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_profile_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"supersedes_submission_id" uuid,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"nik" varchar(32) NOT NULL,
	"account_phone_snapshot" varchar(32) NOT NULL,
	"email" varchar(255),
	"alternate_contact" varchar(64),
	"proposed_business_name" varchar(255) NOT NULL,
	"business_category" varchar(64) NOT NULL,
	"business_description" text,
	"province" varchar(128) NOT NULL,
	"regency_or_city" varchar(128) NOT NULL,
	"district" varchar(128) NOT NULL,
	"village_or_subdistrict" varchar(128) NOT NULL,
	"address_detail" text NOT NULL,
	"ktp_document_id" uuid NOT NULL,
	"data_accuracy_accepted_at" timestamp with time zone NOT NULL,
	"merchant_terms_accepted_at" timestamp with time zone NOT NULL,
	"merchant_terms_version" varchar(32) NOT NULL,
	"privacy_consent_accepted_at" timestamp with time zone NOT NULL,
	"privacy_notice_version" varchar(32) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_merchant_submissions_profile_revision" UNIQUE("merchant_profile_id","revision_number")
);
--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD COLUMN "current_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_verification_audit_logs" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_documents" ADD CONSTRAINT "merchant_onboarding_documents_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_drafts" ADD CONSTRAINT "merchant_onboarding_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_drafts" ADD CONSTRAINT "merchant_onboarding_drafts_ktp_document_id_merchant_onboarding_documents_id_fk" FOREIGN KEY ("ktp_document_id") REFERENCES "public"."merchant_onboarding_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_submissions" ADD CONSTRAINT "merchant_onboarding_submissions_merchant_profile_id_merchant_profiles_id_fk" FOREIGN KEY ("merchant_profile_id") REFERENCES "public"."merchant_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_submissions" ADD CONSTRAINT "merchant_onboarding_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_submissions" ADD CONSTRAINT "merchant_onboarding_submissions_supersedes_submission_id_merchant_onboarding_submissions_id_fk" FOREIGN KEY ("supersedes_submission_id") REFERENCES "public"."merchant_onboarding_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_onboarding_submissions" ADD CONSTRAINT "merchant_onboarding_submissions_ktp_document_id_merchant_onboarding_documents_id_fk" FOREIGN KEY ("ktp_document_id") REFERENCES "public"."merchant_onboarding_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_merchant_onboarding_docs_owner" ON "merchant_onboarding_documents" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_onboarding_drafts_user_id" ON "merchant_onboarding_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_submissions_profile_id" ON "merchant_onboarding_submissions" USING btree ("merchant_profile_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_submissions_user_id" ON "merchant_onboarding_submissions" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_merchant_submissions_status" ON "merchant_onboarding_submissions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_current_submission_id_merchant_onboarding_submissions_id_fk" FOREIGN KEY ("current_submission_id") REFERENCES "public"."merchant_onboarding_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_verification_audit_logs" ADD CONSTRAINT "profile_verification_audit_logs_submission_id_merchant_onboarding_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."merchant_onboarding_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_merchant_profiles_current_submission" ON "merchant_profiles" USING btree ("current_submission_id");--> statement-breakpoint
CREATE INDEX "idx_profile_verification_audit_submission" ON "profile_verification_audit_logs" USING btree ("submission_id");