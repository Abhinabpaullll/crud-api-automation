# Screenshot checklist

Capture screenshots only after rerunning the relevant command. Keep tokens, personal account details, and database connection credentials out of the image.

1. **Repository structure:** root README and `backend/`, `docs/`, `postman/`, `reports/` visible.
2. **Contract:** OpenAPI paths and Student schema visible, with no private environment values on screen.
3. **Postman collection:** six ordered folders and `TC-COVERAGE.md` alongside the collection.
4. **Successful lifecycle:** Newman/Postman view showing TC01 create and TC05 204 delete with empty-body assertion.
5. **Validation:** TC09 invalid email and TC23 case-insensitive duplicate with exact error codes.
6. **Data-driven run:** Newman summary showing eight iterations and zero failed requests/assertions.
7. **HTML report:** open `reports/api/api-report.html` and show request/assertion totals.
8. **JUnit output:** show the generated XML file and its test/suite totals in an editor.
9. **Mutation evidence:** `npm run test:mutations` output showing a target TC failure and the restored folder passing.
10. **GitHub Actions:** after the repository is pushed, show the successful run and its `api-reports` artifact. If a run fails, capture the failing step and Newman error table instead.

The Restful-Booker proof run passed after retrying with external network access. Re-run it before capturing a fresh screenshot, since the public host can be intermittently unavailable.
