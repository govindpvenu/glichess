CREATE TABLE "game_moves" (
	"game_id" text NOT NULL,
	"ply" integer NOT NULL,
	"san" text NOT NULL,
	"uci" text NOT NULL,
	"clock_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_moves_game_id_ply_pk" PRIMARY KEY("game_id","ply")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"white_id" text,
	"black_id" text,
	"white_name" text,
	"black_name" text,
	"creator_id" text,
	"creator_color" text,
	"source" text NOT NULL,
	"rematch_of_id" text,
	"time_control" text NOT NULL,
	"initial_ms" integer NOT NULL,
	"increment_ms" integer NOT NULL,
	"rated" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"result" text,
	"termination" text,
	"fen" text NOT NULL,
	"white_ms" integer NOT NULL,
	"black_ms" integer NOT NULL,
	"white_rating_before" integer,
	"white_rating_after" integer,
	"black_rating_before" integer,
	"black_rating_after" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rating" double precision DEFAULT 1500 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rating_deviation" double precision DEFAULT 350 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rating_volatility" double precision DEFAULT 0.06 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rated_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_white_id_users_id_fk" FOREIGN KEY ("white_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_black_id_users_id_fk" FOREIGN KEY ("black_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_white_id_index" ON "games" USING btree ("white_id");--> statement-breakpoint
CREATE INDEX "games_black_id_index" ON "games" USING btree ("black_id");--> statement-breakpoint
CREATE INDEX "games_live_status_index" ON "games" USING btree ("status") WHERE "games"."status" in ('waiting', 'active');