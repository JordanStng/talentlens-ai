# TalentLens - Demo Script (Jordan)

Walkthrough of the prototype. No live analysis - Hoang runs that afterwards.

**Before presenting:** the applications must already be analyzed, so that Approved,
History and the Assistant have data in them. Needed for the script to work:
two candidates with an **invite** pill and similar scores (Marco Bauer, Jonas Krueger),
one content rejection (Heinrich Moeller), one knockout rejection (no CV),
and a clean history without duplicates.

---

## OPENING

- All right, thank you.
- Now that we've seen the theory behind it, let's move over to what we've actually built.
- For that, we have a live prototype.
- When we open it up, the first thing that we see is the screening screen, where we drop in the applications.
- But before I go into that, let me quickly go over the whole feel of the app and what we intended behind it.
- The idea was to create something very simple and easy to understand, so that even non-technical people can use it without issues.
- We made a mix between a typical dashboard, which most people working in HR have seen before, and ChatGPT, which is something almost anybody has seen at this point.
- We did that to make it as easy as possible, because if it's not easy, then people probably won't use it.

## SCREENING

- Now, what have we actually built?
- The first screen, like I mentioned, is the screening section, where you can drop in the applications.
- And you can drop them in several ways.
- There can be separate files, or they can just be one big PDF.
- We built a whole system that automatically detects which file belongs to which candidate, so you don't have to sort anything manually.
- You can just throw everything into one bucket.
- It gets sorted automatically, it shows up here, and then you can start analyzing them, which we'll be seeing in a second.

## REQUIREMENTS

- Before that, let's move over to the requirements screen first, because this is essentially the heart of where all the analysis is happening from.
- This is the screen where you set the whole requirements the entire analysis is based on.
- In our case, we have a job posting for a junior full stack developer, and everything the AI does is measured exactly against this posting.
- And you have complete freedom on how you want to structure it.
- You can edit it up here, and you can see it in just markdown.
- When you're done, you can just show the reading view again.
- The way we have done it is we made a little table here, which shows information at a glance, like the location, the type, the level and the salary.
- When you scroll down, you get some basic info about the company, what you will do, and so on.
- And further down, you have something called the knockout criteria.
- That essentially means: if somebody applies for this job and doesn't send in a cover letter or a CV, the system will trigger a knockout.
- They get rejected immediately, without any analysis happening in the first place.
- Which saves us time and money, because there will just not be any AI involved at all.

## APPROVED

- Now, after you put something in and it got analyzed, a candidate either gets rejected or approved.
- This is the approved section.
- Once the screening is done, the candidates with the highest scores end up here, and they get split into two categories.
- Everybody with a score higher than 75 gets a little pill called invite.
- And everybody between 50 and 75 gets a review pill, meaning you should take another look at them.
- But invite doesn't mean you just invite them blindly.
- It means these are the strongest matches and the ones you should start with.
- The decision is still yours, we only give you the order to look at them in.
- So let's take a look at Marco Bauer for example.
- You don't just see the number, you can click on him and see the entire reasoning behind it.
- At the top you get a short summary of what he brings and how well he fits.
- Then you get the critical points, so why this person was rated positively or not.
- And below that you see the four areas the score is based on: the work experience, the skills, the education, and the language skills.
- The AI rates each of them from 1 to 10, and it has to back every rating up with a quote from the actual CV, which you can see right here.
- React and TypeScript, Node.js, backend, and so on.
- So every rating here is tied back to something that's actually written in the CV.
- And the total score up here is not the AI's gut feeling either.
- It's calculated out of these four ratings, with our own weighting.
- So you can always trace a score all the way back to a line in the CV.

## HISTORY

- And when you have approved candidates, you also have candidates that are not approved, and those you will find in the history section, where everything is documented.
- So here are the people that we've just seen that are approved, but you can also see the people that have been rejected.
- For example because they did not have enough work experience.
- And below that you can see somebody that got hit by a knockout criterion, because they had no CV submitted.
- And when you click on them, you can see the reasoning behind it.
- In this case not enough work experience, missing core skills, and then again the four areas, with language skills at 10 out of 10 for example.
- And maybe you agree with it, maybe you don't.

## ASSISTANT

- Now, one thing that was important to us: the decision is always made by a human.
- This is an assistant, it does not decide anything for you.
- And where it actually helps is when the case is not obvious.
- So here for example we have Marco Bauer and Jonas Krueger.
- They both got an invite, they have a very similar score, and on the first look it's really not clear who I should pick.
- So I can just ask: compare Marco Bauer and Jonas Krueger on their skills.
- And I ask it the same way I would ask any chatbot like ChatGPT.
- The agent goes off, pulls up both evaluations, puts them next to each other, and you can even see up here which tools it used to get there.
- So it gives me everything I need to make that call, but I'm still the one making it.
- And I can also zoom out and ask something like: what do most applications fail on?
- Then it goes through all the applications and aggregates that for me, which is something you would never get by clicking through the list one by one.
- And that's actually useful, because if most people fail on the same requirement, that might tell us something about our own job posting.
- So if something is unclear to you, you can either check it here, or if you want to dig deeper, you can just ask the assistant.

## CLOSE / HANDOFF

- And that's essentially the whole thing.
- You put in the applications, you get a ranked list with the reasoning behind it, and on top of that you can just ask it anything you want.
- And how this actually works in practice, when it comes to uploading and running it, my partner Hoang is going to show you now.
