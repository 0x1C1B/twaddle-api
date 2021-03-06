import { URL } from "url";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as CustomStrategy } from "passport-custom";
import env from "./env";
import redis from "./redis";
import User from "../models/user";

passport.use(
  "credentials",
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
      session: false,
    },
    (username, password, done) => {
      User.findOne({ username })
        .then((user) => {
          if (!user) {
            return done(null, false);
          }

          if (!user.isValidPassword(password)) {
            return done(null, false);
          }

          return done(null, user);
        })
        .catch((err) => done(err));
    }
  )
);

passport.use(
  "token",
  new JwtStrategy(
    {
      algorithms: ["RS256"],
      secretOrKey: env.security.jwt.publicKey,
      issuer: env.security.jwt.issuer,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    },
    (payload, done) => {
      User.findOne({ username: payload.sub })
        .then((user) => {
          if (!user) {
            return done(null, false);
          }

          return done(null, user);
        })
        .catch((err) => done(err));
    }
  )
);

passport.use(
  "ticket",
  new CustomStrategy((req, done) => {
    try {
      const ticket = new URL(
        req.url,
        `http://${req.headers.host}`
      ).searchParams.get("ticket");

      redis
        // eslint-disable-next-line no-underscore-dangle
        .get(`ticket:${ticket}`)
        .then(async (subject) => {
          if (!subject) {
            return done(null, false);
          }

          return User.findOne({ username: subject })
            .then((user) => {
              if (!user) {
                return done(null, false);
              }

              return done(null, user);
            })
            .catch((err) => done(err));
        })
        .catch((err) => done(err));
    } catch (err) {
      done(err);
    }
  })
);

export default passport;
